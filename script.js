class App {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('tb_user')) || null;
        this.activeView = 'kanban';
        this.activeBoardType = 'personal';
        this.activeGroup = '';
        this.priorityFilter = 'all';
        this.currentCalendarDate = new Date();

        this.timerInterval = null;
        this.timerTimeLeft = 25 * 60;
        this.timerMode = 'work';
        this.isTimerRunning = false;

        this.currentTaskMembers = [];

        this.init();
    }

    init() {
        this.checkAuth();
        this.renderKanban();
        this.renderCalendar();
        this.updateGroupSelectOptions();
        this.renderFriendsList();
        this.updateProfileBadge();
    }

    checkAuth() {
        const authModal = document.getElementById('auth-modal');
        if (!this.currentUser) {
            if (authModal) authModal.classList.remove('hidden');
        } else {
            if (authModal) authModal.classList.add('hidden');
            this.updateUserProfileUI();
        }
    }

    handleAuthSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        if (!email) return;

        this.currentUser = { email, name: email.split('@')[0] };
        localStorage.setItem('tb_user', JSON.stringify(this.currentUser));

        document.getElementById('auth-modal').classList.add('hidden');
        this.updateUserProfileUI();
        this.renderKanban();
        this.renderFriendsList();
        this.updateProfileBadge();
        this.showToast('เข้าสู่ระบบสำเร็จ!', 'success');
    }

    loginAsGuest() {
        this.currentUser = { email: 'guest@timebytime.local', name: 'ผู้เยี่ยมชม (Guest)' };
        localStorage.setItem('tb_user', JSON.stringify(this.currentUser));
        document.getElementById('auth-modal').classList.add('hidden');
        this.updateUserProfileUI();
        this.renderKanban();
        this.showToast('เข้าใช้งานในฐานะ Guest', 'info');
    }

    handleLogout() {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
            localStorage.removeItem('tb_user');
            this.currentUser = null;
            location.reload();
        }
    }

    updateUserProfileUI() {
        if (!this.currentUser) return;
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.innerText = this.currentUser.name;
    }

    switchView(view) {
        this.activeView = view;
        document.getElementById('view-kanban').classList.toggle('hidden', view !== 'kanban');
        document.getElementById('view-calendar').classList.toggle('hidden', view !== 'calendar');
        document.getElementById('view-pomodoro').classList.toggle('hidden', view !== 'pomodoro');
        document.getElementById('view-team').classList.toggle('hidden', view !== 'team');

        document.getElementById('nav-kanban').classList.toggle('active', view === 'kanban');
        document.getElementById('nav-calendar').classList.toggle('active', view === 'calendar');
        document.getElementById('nav-pomodoro').classList.toggle('active', view === 'pomodoro');
        document.getElementById('nav-team').classList.toggle('active', view === 'team');

        if (view === 'calendar') this.renderCalendar();
        if (view === 'team') this.renderFriendsList();
    }

    setBoardType(type) {
        this.activeBoardType = type;
        document.getElementById('btn-board-personal').classList.toggle('active', type === 'personal');
        document.getElementById('btn-board-group').classList.toggle('active', type === 'group');
        document.getElementById('group-board-controls').classList.toggle('hidden', type !== 'group');
        this.renderKanban();
    }

    getStoredTasks() { return JSON.parse(localStorage.getItem('tb_tasks')) || []; }
    saveTasks(tasks) { localStorage.setItem('tb_tasks', JSON.stringify(tasks)); }

    getStoredFriends() { return JSON.parse(localStorage.getItem('tb_friends')) || []; }
    saveFriends(friends) { localStorage.setItem('tb_friends', JSON.stringify(friends)); }

    getInvitations() { return JSON.parse(localStorage.getItem('tb_invitations')) || []; }
    saveInvitations(invites) { localStorage.setItem('tb_invitations', JSON.stringify(invites)); }

    handleAddFriend(e) {
        e.preventDefault();
        const emailInput = document.getElementById('friend-email-input');
        const email = emailInput.value.trim().toLowerCase();

        if (!email) return;

        let friends = this.getStoredFriends();
        if (friends.includes(email)) {
            this.showToast('อีเมลนี้อยู่ในรายชื่อเพื่อนอยู่แล้ว', 'warning');
            return;
        }

        friends.push(email);
        this.saveFriends(friends);
        emailInput.value = '';
        this.renderFriendsList();
        this.showToast('เพิ่มเพื่อนใหม่เรียบร้อยแล้ว', 'success');
    }

    removeFriend(email) {
        if (!confirm(`คุณต้องการลบ ${email} ออกจากรายชื่อเพื่อนใช่หรือไม่?`)) return;

        let friends = this.getStoredFriends();
        friends = friends.filter(f => f !== email);
        this.saveFriends(friends);
        this.renderFriendsList();
        this.showToast('ลบเพื่อนออกจากรายชื่อแล้ว', 'info');
    }

    renderFriendsList() {
        const list = document.getElementById('friends-list');
        if (!list) return;

        const friends = this.getStoredFriends();
        list.innerHTML = '';

        if (friends.length === 0) {
            list.innerHTML = '<div class="text-xs text-gray-500 py-3 text-center">ยังไม่มีรายชื่อเพื่อน กดเพิ่มเพื่อนด้านบนได้เลย</div>';
            return;
        }

        friends.forEach(email => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2.5 bg-[#f7f5ed] rounded-xl border border-[#c0b59f]/60';
            item.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="w-6 h-6 rounded-full bg-[#385441] text-white flex items-center justify-center text-[10px] font-bold">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <span class="text-xs font-semibold text-[#1f3627]">${this.escapeHtml(email)}</span>
                </div>
                <button onclick="app.removeFriend('${email}')" class="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded hover:bg-red-50">
                    <i class="fa-solid fa-user-minus"></i> ลบ
                </button>
            `;
            list.appendChild(item);
        });

        this.updateTaskFriendSelectOptions();
    }

    updateTaskFriendSelectOptions() {
        const select = document.getElementById('task-friend-select');
        if (!select) return;

        const friends = this.getStoredFriends();
        select.innerHTML = '<option value="">-- เลือกเพื่อนจากรายชื่อ --</option>';

        friends.forEach(email => {
            const opt = document.createElement('option');
            opt.value = email;
            opt.innerText = email;
            select.appendChild(opt);
        });
    }

    openProfileModal() {
        if (!this.currentUser) return;
        document.getElementById('profile-modal-name').innerText = this.currentUser.name;
        document.getElementById('profile-modal-email').innerText = this.currentUser.email;

        this.renderProfileInvitations();
        document.getElementById('profile-modal').classList.remove('hidden');
    }

    closeProfileModal() {
        document.getElementById('profile-modal').classList.add('hidden');
    }

    renderProfileInvitations() {
        const list = document.getElementById('profile-invitations-list');
        if (!list) return;

        const invites = this.getInvitations();
        const userEmail = this.currentUser ? this.currentUser.email : 'guest';
        const myInvites = invites.filter(i => i.targetEmail === userEmail && i.status === 'pending');

        list.innerHTML = '';
        if (myInvites.length === 0) {
            list.innerHTML = '<div class="text-xs text-gray-500 py-3 text-center">ไม่มีคำเชิญเข้าร่วมบอร์ดในขณะนี้</div>';
            return;
        }

        myInvites.forEach(inv => {
            const item = document.createElement('div');
            item.className = 'p-3 bg-white rounded-xl border border-[#c0b59f] shadow-sm space-y-2';
            item.innerHTML = `
                <div>
                    <h5 class="text-xs font-bold text-[#1f3627]">${this.escapeHtml(inv.taskTitle)}</h5>
                    <p class="text-[10px] text-gray-500">เชิญโดย: ${this.escapeHtml(inv.senderEmail)} | บอร์ด: ${this.escapeHtml(inv.boardName)}</p>
                </div>
                <div class="flex gap-2 justify-end">
                    <button onclick="app.respondInvitation('${inv.id}', 'accepted')" class="px-3 py-1 bg-[#385441] text-white text-xs font-bold rounded-lg hover:bg-[#2d4735]">ยอมรับ</button>
                    <button onclick="app.respondInvitation('${inv.id}', 'rejected')" class="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300">ปฏิเสธ</button>
                </div>
            `;
            list.appendChild(item);
        });
    }

    respondInvitation(invId, status) {
        let invites = this.getInvitations();
        const idx = invites.findIndex(i => i.id === invId);
        if (idx !== -1) {
            invites[idx].status = status;
            this.saveInvitations(invites);
            this.renderProfileInvitations();
            this.updateProfileBadge();
            this.renderKanban();
            this.showToast(status === 'accepted' ? 'ตอบรับคำเชิญเรียบร้อยแล้ว' : 'ปฏิเสธคำเชิญแล้ว', 'info');
        }
    }

    updateProfileBadge() {
        const badge = document.getElementById('profile-invite-badge');
        if (!badge) return;

        const invites = this.getInvitations();
        const userEmail = this.currentUser ? this.currentUser.email : 'guest';
        const pendingCount = invites.filter(i => i.targetEmail === userEmail && i.status === 'pending').length;

        badge.classList.toggle('hidden', pendingCount === 0);
    }

    renderKanban() {
        const allTasks = this.getStoredTasks();
        const userEmail = this.currentUser ? this.currentUser.email : 'guest';

        let filtered = allTasks.filter(t => {
            if (this.activeBoardType === 'personal') {
                return t.type === 'personal' && t.userEmail === userEmail;
            } else {
                const isMember = t.userEmail === userEmail || (t.taggedEmails && t.taggedEmails.includes(userEmail));
                if (!isMember) return false;
                if (this.activeGroup) return t.boardName === this.activeGroup;
                return true;
            }
        });

        const cols = { todo: [], doing: [], done: [] };
        filtered.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });

        ['todo', 'doing', 'done'].forEach(status => {
            const container = document.getElementById(`col-${status}`);
            const badge = document.getElementById(`badge-${status}`);
            if (!container) return;

            container.innerHTML = '';
            if (badge) badge.innerText = cols[status].length;

            cols[status].forEach(task => container.appendChild(this.createTaskCard(task)));
        });

        this.updateGroupSelectOptions();
    }

    createTaskCard(task) {
            const card = document.createElement('div');
            card.className = 'p-3 bg-white rounded-xl border border-[#c0b59f] shadow-sm hover:shadow-md transition cursor-pointer space-y-1.5';
            card.onclick = () => this.openEditTaskModal(task.id);

            const priColors = { low: 'bg-emerald-100 text-emerald-800', medium: 'bg-amber-100 text-amber-800', high: 'bg-red-100 text-red-800' };
            const priTexts = { low: 'ทั่วไป', medium: 'ปานกลาง', high: 'ด่วน' };

            card.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${priColors[task.priority] || priColors.medium}">
                    ${priTexts[task.priority] || 'ทั่วไป'}
                </span>
                ${task.date ? `<span class="text-[10px] text-gray-500"><i class="fa-regular fa-calendar mr-1"></i>${task.date}</span>` : ''}
            </div>
            <h4 class="text-xs font-bold text-[#1f3627] truncate">${this.escapeHtml(task.title)}</h4>
            ${task.location ? `<div class="text-[10px] text-gray-600 truncate"><i class="fa-solid fa-location-dot text-red-500 mr-1"></i>${this.escapeHtml(task.location)}</div>` : ''}
            ${task.time ? `<div class="text-[10px] text-amber-700 font-medium"><i class="fa-solid fa-clock mr-1"></i>${this.escapeHtml(task.time)} น.</div>` : ''}
            ${task.boardName ? `<div class="text-[9px] text-[#385441] bg-[#e0d8c7] inline-block px-1.5 py-0.5 rounded font-bold">${this.escapeHtml(task.boardName)}</div>` : ''}
        `;
        return card;
    }

    updateGroupSelectOptions() {
        const select = document.getElementById('group-select');
        const modalSelect = document.getElementById('task-board-name');
        if (!select) return;

        const allTasks = this.getStoredTasks();
        const userEmail = this.currentUser ? this.currentUser.email : 'guest';
        
        const groups = new Set();
        allTasks.forEach(t => {
            if (t.type === 'group' && t.boardName && (t.userEmail === userEmail || (t.taggedEmails && t.taggedEmails.includes(userEmail)))) {
                groups.add(t.boardName);
            }
        });

        select.innerHTML = '<option value="">-- บอร์ดกลุ่มทั้งหมด --</option>';
        if (modalSelect) modalSelect.innerHTML = '<option value="งานกลุ่มทั่วไป">งานกลุ่มทั่วไป</option>';

        groups.forEach(groupName => {
            const opt = document.createElement('option');
            opt.value = groupName;
            opt.innerText = groupName;
            select.appendChild(opt);

            if (modalSelect) {
                const modalOpt = document.createElement('option');
                modalOpt.value = groupName;
                modalOpt.innerText = groupName;
                modalSelect.appendChild(modalOpt);
            }
        });
    }

    handleGroupChange(val) {
        this.activeGroup = val;
        this.renderKanban();
    }

    addNewGroupBoard() {
        const groupName = prompt('กรุณาระบุชื่อบอร์ดกลุ่มใหม่:');
        if (groupName && groupName.trim()) {
            this.activeGroup = groupName.trim();
            this.updateGroupSelectOptions();
            document.getElementById('group-select').value = this.activeGroup;
            this.renderKanban();
            this.showToast(`สร้างบอร์ดกลุ่ม "${this.activeGroup}" สำเร็จ`, 'success');
        }
    }

    openTaskModal() {
        document.getElementById('task-id').value = '';
        document.getElementById('task-title').value = '';
        document.getElementById('task-date').value = '';
        document.getElementById('task-time').value = '';
        document.getElementById('task-location').value = '';
        document.getElementById('task-priority').value = 'medium';
        document.getElementById('task-status').value = 'todo';
        document.getElementById('task-type').value = this.activeBoardType;

        this.currentTaskMembers = [];
        this.renderTaskTaggedMembers();
        this.updateTaskFriendSelectOptions();
        this.toggleTaskTypeFields(this.activeBoardType);

        document.getElementById('ocr-result-preview').classList.add('hidden');
        document.getElementById('btn-delete-task').classList.add('hidden');
        document.getElementById('task-modal').classList.remove('hidden');
    }

    openEditTaskModal(id) {
        const allTasks = this.getStoredTasks();
        const task = allTasks.find(t => t.id === id);
        if (!task) return;

        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-date').value = task.date || '';
        document.getElementById('task-time').value = task.time || '';
        document.getElementById('task-location').value = task.location || '';
        document.getElementById('task-priority').value = task.priority || 'medium';
        document.getElementById('task-status').value = task.status || 'todo';
        document.getElementById('task-type').value = task.type || 'personal';

        this.currentTaskMembers = task.taggedEmails || [];
        this.renderTaskTaggedMembers();
        this.updateTaskFriendSelectOptions();
        this.toggleTaskTypeFields(task.type || 'personal');

        if (task.type === 'group' && task.boardName) {
            const boardSelect = document.getElementById('task-board-name');
            if (boardSelect) boardSelect.value = task.boardName;
        }

        document.getElementById('btn-delete-task').classList.remove('hidden');
        document.getElementById('task-modal').classList.remove('hidden');
    }

    closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }

    toggleTaskTypeFields(type) {
        const groupSelectBox = document.getElementById('task-group-board-select-box');
        const tagFriendBox = document.getElementById('task-tag-friend-box');

        if (groupSelectBox) groupSelectBox.classList.toggle('hidden', type !== 'group');
        if (tagFriendBox) tagFriendBox.classList.toggle('hidden', type !== 'group');
    }

    addMemberToCurrentTask() {
        const select = document.getElementById('task-friend-select');
        const email = select.value;

        if (!email) return;
        if (this.currentTaskMembers.includes(email)) {
            this.showToast('สมาชิกคนนี้ถูกแท็กอยู่ในบอร์ดแล้ว', 'warning');
            return;
        }

        this.currentTaskMembers.push(email);
        this.renderTaskTaggedMembers();
        select.value = '';
    }

    removeMemberFromCurrentTask(email) {
        this.currentTaskMembers = this.currentTaskMembers.filter(m => m !== email);
        this.renderTaskTaggedMembers();
        this.showToast(`ลบ ${email} ออกจากบอร์ดแล้ว`, 'info');
    }

    renderTaskTaggedMembers() {
        const container = document.getElementById('task-tagged-members-list');
        if (!container) return;

        container.innerHTML = '';
        if (this.currentTaskMembers.length === 0) {
            container.innerHTML = '<div class="text-[10px] text-gray-500 italic">ยังไม่มีสมาชิกที่ถูกแท็กในบอร์ดนี้</div>';
            return;
        }

        this.currentTaskMembers.forEach(email => {
            const tag = document.createElement('div');
            tag.className = 'flex justify-between items-center bg-white px-2 py-1 rounded border border-[#c0b59f] text-[10px]';
            tag.innerHTML = `
                <span class="text-[#1f3627] font-semibold">${this.escapeHtml(email)}</span>
                <button type="button" onclick="app.removeMemberFromCurrentTask('${email}')" class="text-red-600 hover:text-red-800 font-bold ml-2">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            container.appendChild(tag);
        });
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        const taskId = document.getElementById('task-id').value;
        const title = document.getElementById('task-title').value.trim();
        const date = document.getElementById('task-date').value;
        const time = document.getElementById('task-time').value;
        const location = document.getElementById('task-location').value.trim();
        const priority = document.getElementById('task-priority').value;
        const status = document.getElementById('task-status').value;
        const type = document.getElementById('task-type').value;

        if (!title) return;

        const userEmail = this.currentUser ? this.currentUser.email : 'guest';
        let allTasks = this.getStoredTasks();
        const boardNameEl = document.getElementById('task-board-name');
        const boardName = (type === 'group' && boardNameEl) ? boardNameEl.value : null;

        if (taskId) {
            const idx = allTasks.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                allTasks[idx] = {
                    ...allTasks[idx],
                    title, date, time, location, priority, status, type, boardName,
                    taggedEmails: this.currentTaskMembers,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            const newTask = {
                id: 't_' + Date.now(),
                userEmail, title, date, time, location, priority, status, type, boardName,
                taggedEmails: this.currentTaskMembers,
                createdAt: new Date().toISOString()
            };
            allTasks.push(newTask);

            if (type === 'group' && this.currentTaskMembers.length > 0) {
                let invites = this.getInvitations();
                this.currentTaskMembers.forEach(targetEmail => {
                    if (targetEmail !== userEmail) {
                        invites.push({
                            id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                            taskId: newTask.id,
                            taskTitle: title,
                            boardName: boardName || 'งานกลุ่มทั่วไป',
                            senderEmail: userEmail,
                            targetEmail,
                            status: 'pending'
                        });
                    }
                });
                this.saveInvitations(invites);
            }
        }

        this.saveTasks(allTasks);
        this.closeTaskModal();
        this.renderKanban();
        this.renderCalendar();
        this.showToast(taskId ? 'แก้ไขข้อมูลเรียบร้อยแล้ว' : 'เพิ่มรายการใหม่สำเร็จ!', 'success');
    }

    deleteTask(id) {
        if (!confirm('คุณต้องการลบรายการงานนี้ใช่หรือไม่?')) return;

        const targetId = id || document.getElementById('task-id').value;
        if (!targetId) return;

        let allTasks = this.getStoredTasks();
        allTasks = allTasks.filter(t => t.id !== targetId);

        this.saveTasks(allTasks);
        this.closeTaskModal();
        this.renderKanban();
        this.renderCalendar();
        this.showToast('ลบรายการงานเรียบร้อยแล้ว', 'info');
    }

    handleImageOCRAndLocation(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.showToast('กำลังใช้ AI สแกนวิเคราะห์ภาพและจัดสรรสถานที่...', 'info');

        setTimeout(() => {
            const fileName = file.name.split('.')[0];
            const title = 'งานสแกน: ' + fileName;
            const simulatedLocation = 'อาคารเรียน มหาวิทยาลัยพะเยา (ตึก ICT)';
            const simulatedTime = '09:00 - 12:00';

            document.getElementById('task-title').value = title;
            document.getElementById('task-location').value = simulatedLocation;
            document.getElementById('task-time').value = '09:00';
            document.getElementById('task-priority').value = 'high';

            const preview = document.getElementById('ocr-result-preview');
            document.getElementById('ocr-desc').innerText = '✨ AI อ่านสำเร็จ: ดึงกำหนดการและหัวข้องานเรียบร้อย';
            document.getElementById('ocr-location-info').innerText = `📍 จัดสรรพิกัด: ${simulatedLocation} | ⏰ ช่วงเวลา: ${simulatedTime}`;
            preview.classList.remove('hidden');

            this.showToast('วิเคราะห์รูปภาพและจัดสรรเวลาสถานที่สำเร็จ!', 'success');
        }, 1500);
    }

    optimizeScheduleWithAI() {
        let allTasks = this.getStoredTasks();
        if (allTasks.length === 0) {
            this.showToast('ยังไม่มีรายการงานให้ AI จัดสรร', 'warning');
            return;
        }

        this.showToast('🤖 AI กำลังคำนวณและจัดสรรวันเวลาทำงานให้มีประสิทธิภาพสูงสุด...', 'info');

        setTimeout(() => {
            const today = new Date();
            allTasks = allTasks.map((task, index) => {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + (index % 5));
                const formattedDate = targetDate.toISOString().split('T')[0];

                return {
                    ...task,
                    date: formattedDate,
                    priority: index % 2 === 0 ? 'high' : 'medium'
                };
            });

            this.saveTasks(allTasks);
            this.renderKanban();
            this.renderCalendar();
            this.showToast('✨ AI จัดสรรลำดับวันและเวลาทำงานให้เรียบร้อยแล้ว!', 'success');
        }, 1800);
    }

    setTimerMode(mode) {
        this.timerMode = mode;
        this.stopTimer();

        if (mode === 'work') this.timerTimeLeft = 25 * 60;
        else if (mode === 'shortBreak') this.timerTimeLeft = 5 * 60;
        else if (mode === 'longBreak') this.timerTimeLeft = 15 * 60;

        document.getElementById('btn-pomo-work').className = mode === 'work' ? 'px-3 py-1 bg-[#385441] text-white rounded-lg text-xs font-bold' : 'px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold';
        document.getElementById('btn-pomo-short').className = mode === 'shortBreak' ? 'px-3 py-1 bg-[#385441] text-white rounded-lg text-xs font-bold' : 'px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold';
        document.getElementById('btn-pomo-long').className = mode === 'longBreak' ? 'px-3 py-1 bg-[#385441] text-white rounded-lg text-xs font-bold' : 'px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold';

        this.updateTimerDisplay();
    }

    toggleTimer() {
        if (this.isTimerRunning) this.stopTimer();
        else this.startTimer();
    }

    startTimer() {
        this.isTimerRunning = true;
        document.getElementById('btn-pomo-start').innerText = 'พักการนับเวลา';
        this.timerInterval = setInterval(() => {
            if (this.timerTimeLeft > 0) {
                this.timerTimeLeft--;
                this.updateTimerDisplay();
            } else {
                this.stopTimer();
                this.showToast('หมดเวลาโฟกัสแล้ว!', 'warning');
            }
        }, 1000);
    }

    stopTimer() {
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
        document.getElementById('btn-pomo-start').innerText = 'เริ่มจับเวลา';
    }

    resetTimer() { this.setTimerMode(this.timerMode); }

    updateTimerDisplay() {
        const mins = Math.floor(this.timerTimeLeft / 60);
        const secs = this.timerTimeLeft % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        const display = document.getElementById('pomo-display');
        if (display) display.innerText = formatted;
    }

    renderCalendar() {
        const grid = document.getElementById('calendar-days-grid');
        const title = document.getElementById('calendar-month-year');
        if (!grid || !title) return;

        grid.innerHTML = '';
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();

        const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        title.innerText = `${monthNames[month]} ${year + 543}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'h-24 bg-[#e0d8c7]/40 rounded-xl';
            grid.appendChild(emptyCell);
        }

        const allTasks = this.getStoredTasks();

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'h-24 bg-white p-2 rounded-xl border border-[#c0b59f] overflow-y-auto space-y-1';

            const formattedDay = String(day).padStart(2, '0');
            const formattedMonth = String(month + 1).padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

            cell.innerHTML = `<div class="text-xs font-bold text-[#1f3627] mb-1">${day}</div>`;

            const dayTasks = allTasks.filter(t => t.date === dateStr);
            dayTasks.forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.className = 'text-[9px] bg-[#385441] text-white p-1 rounded truncate cursor-pointer';
                taskEl.innerText = task.title;
                taskEl.onclick = (e) => {
                    e.stopPropagation();
                    this.openEditTaskModal(task.id);
                };
                cell.appendChild(taskEl);
            });

            grid.appendChild(cell);
        }
    }

    changeMonth(offset) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + offset);
        this.renderCalendar();
    }

    goToday() {
        this.currentCalendarDate = new Date();
        this.renderCalendar();
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        const colors = {
            success: 'bg-[#385441] text-white',
            warning: 'bg-amber-600 text-white',
            info: 'bg-[#2d4735] text-white',
            error: 'bg-red-700 text-white'
        };

        toast.className = `fixed bottom-5 right-5 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium z-50 transition-all duration-300 ${colors[type] || colors.info}`;
        toast.innerText = message;
        toast.classList.remove('hidden');

        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new App();
});