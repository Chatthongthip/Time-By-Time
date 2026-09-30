class Entity {
    constructor(id = null) {
        this.id = id || this.generateId();
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
}

class User extends Entity {
    constructor(email, name, password) {
        super();
        this.email = email.toLowerCase().trim();
        this.name = name.trim();
        this.password = password;
        this.createdAt = new Date().toISOString();
    }
    checkPassword(inputPassword) {
        return this.password === inputPassword;
    }
}

class Task extends Entity {
    constructor({
        id,
        title,
        startDate,
        dueDate,
        time,
        location,
        priority,
        status,
        type,
        userEmail,
        boardName,
        taggedEmails,
        dailyPlans,
        useAI,
        createdAt,
        updatedAt
    } = {}) {
        super(id);
        this.title = title || '';
        this.startDate = startDate || '';
        this.dueDate = dueDate || '';
        this.time = time || '';
        this.location = location || '';
        this.priority = priority || 'medium';
        this.status = status || 'todo';
        this.type = type || 'personal';
        this.userEmail = userEmail || '';
        this.boardName = boardName || null;
        this.taggedEmails = taggedEmails || [];
        this.dailyPlans = dailyPlans || [];
        this.useAI = useAI || false;
        this.createdAt = createdAt || new Date().toISOString();
        this.updatedAt = updatedAt || new Date().toISOString();
    }
    addDailyPlan(plan) { this.dailyPlans.push(plan); }
    getDisplayType() {
        return this.type === 'group' ? 'งานกลุ่ม' : 'งานส่วนตัว';
    }
}

class PersonalTask extends Task {
    constructor(data = {}) {
        super(Object.assign({}, data, { type: 'personal' }));
    }
    getDisplayType() {
        return 'งานส่วนตัว';
    }
}

class GroupTask extends Task {
    constructor(data = {}) {
        super(Object.assign({}, data, { type: 'group' }));
        this.boardName = data.boardName || 'งานกลุ่มทั่วไป';
        this.taggedEmails = data.taggedEmails || [];
    }
    getDisplayType() {
        return 'งานกลุ่ม: ' + this.boardName;
    }
    addMember(email) {
        if (!this.taggedEmails.includes(email))
            this.taggedEmails.push(email);
    }
}

class DailyPlan {
    constructor(date, description, estimatedHours) {
        if (estimatedHours === undefined) estimatedHours = 2;
        this.date = date;
        this.description = description;
        this.estimatedHours = estimatedHours;
    }
}

class AIScheduler {
    static analyzeDifficulty(task) {
        var score = 1;
        if (task.priority === 'high') score += 1;
        if (task.priority === 'medium') score += 0.5;
        if (task.title && task.title.length > 40) score += 0.5;
        if (task.location && task.location.length > 0) score += 0.5;
        return Math.min(3, Math.ceil(score));
    }
    static createDailyPlans(task) {
        if (!task.startDate || !task.dueDate) return [];
        var start = new Date(task.startDate);
        var due = new Date(task.dueDate);
        var finishBuffer = task.priority === 'high' ? 2 : 1;
        var finish = new Date(due);
        finish.setDate(due.getDate() - finishBuffer);
        if (finish <= start) return [new DailyPlan(task.startDate, 'ทำงานทั้งหมด: ' + task.title, 4)];
        var difficulty = this.analyzeDifficulty(task);
        var total = Math.ceil((finish - start) / 86400000) + 1;
        var workDays = Math.max(2, Math.min(total, difficulty + 2));
        var steps = ['ศึกษาและวางแผน', 'เริ่มลงมือทำส่วนหลัก', 'พัฒนาและปรับปรุง', 'ทดสอบและแก้ไข', 'ตรวจทานขั้นสุดท้าย', 'เตรียมส่งงาน'];
        var plans = [];
        var cur = new Date(start);
        for (var i = 0; i < workDays && cur <= finish; i++) {
            var dateStr = cur.toISOString().slice(0, 10);
            var description = (steps[i] || ('ดำเนินงานส่วนที่ ' + (i + 1))) + ': ' + task.title;
            var hours = difficulty === 3 ? 3 : 2;
            plans.push(new DailyPlan(dateStr, description, hours));
            cur.setDate(cur.getDate() + 1);
        }
        return plans;
    }
}

class App {
    constructor() {
        this.currentUser = null;
        this.activeView = 'kanban';
        this.activeBoardType = 'personal';
        this.activeGroup = '';
        this.currentCalendarDate = new Date();
        this.timerInterval = null;
        this.timerTimeLeft = 25 * 60;
        this.timerMode = 'work';
        this.isTimerRunning = false;
        this.currentTaskMembers = [];
        this.authMode = 'login';
        this.init();
    }

    init() {
        this.loadCurrentUser();
        this.checkAuth();
        if (this.currentUser) {
            this.renderKanban();
            this.renderCalendar();
            this.updateGroupSelectOptions();
            this.renderFriendsList();
            this.updateProfileBadge();
            this.updateUserProfileUI();
        }
    }

    getUsers() {
        try {
            var raw = localStorage.getItem('tb_users');
            var data = raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(err);
            return [];
        }
    }
    saveUsers(u) {
        try {
            localStorage.setItem('tb_users', JSON.stringify(u));
            return true;
        } catch (err) {
            console.error(err);
            this.showToast('บันทึกบัญชีไม่สำเร็จ (localStorage ถูกปิด?)', 'error');
            return false;
        }
    }
    getTasks() { return this.currentUser ? JSON.parse(localStorage.getItem('tb_tasks_' + this.currentUser.email) || '[]') : []; }
    saveTasks(t) { if (this.currentUser) localStorage.setItem('tb_tasks_' + this.currentUser.email, JSON.stringify(t)); }
    getFriends() { return this.currentUser ? JSON.parse(localStorage.getItem('tb_friends_' + this.currentUser.email) || '[]') : []; }
    saveFriends(f) { if (this.currentUser) localStorage.setItem('tb_friends_' + this.currentUser.email, JSON.stringify(f)); }
    getInvitations() { return JSON.parse(localStorage.getItem('tb_invitations') || '[]'); }
    saveInvitations(i) { localStorage.setItem('tb_invitations', JSON.stringify(i)); }

    loadCurrentUser() {
        const s = localStorage.getItem('tb_current_user');
        if (s) this.currentUser = JSON.parse(s);
    }
    checkAuth() {
        const m = document.getElementById('auth-modal');
        if (!this.currentUser) { if (m) m.classList.remove('hidden'); } else { if (m) m.classList.add('hidden'); }
    }

    switchAuthMode(mode) {
        this.authMode = mode;
        var isReg = mode === 'register';
        var modal = document.getElementById('auth-modal');
        if (modal) modal.classList.remove('hidden');
        var title = document.getElementById('auth-title');
        var desc = document.getElementById('auth-desc-text');
        var nameBox = document.getElementById('auth-name-box');
        if (title) title.innerText = isReg ? 'สมัครสมาชิก TimeByTime' : 'เข้าสู่ระบบ TimeByTime';
        if (desc) desc.innerText = isReg ? 'กรอกชื่อ อีเมล และรหัสผ่านเพื่อสร้างบัญชีใหม่' : 'กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน';
        if (nameBox) {
            if (isReg) nameBox.classList.remove('hidden');
            else nameBox.classList.add('hidden');
        }
    }

    doLogin() {
        this.authMode = 'login';
        this.handleAuthSubmit();
    }

    doRegister() {
        this.authMode = 'register';
        // แสดงช่องชื่อก่อนสมัคร
        var nameBox = document.getElementById('auth-name-box');
        if (nameBox) nameBox.classList.remove('hidden');
        var title = document.getElementById('auth-title');
        if (title) title.innerText = 'สมัครสมาชิก TimeByTime';
        this.handleAuthSubmit();
    }

    handleAuthSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();

        var emailEl = document.getElementById('auth-email');
        var passEl = document.getElementById('auth-password');
        var nameEl = document.getElementById('auth-name');

        var email = emailEl ? String(emailEl.value || '').trim().toLowerCase() : '';
        var password = passEl ? String(passEl.value || '') : '';

        if (!email || !password) {
            this.showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'warning');
            return false;
        }

        var users = this.getUsers();

        // ========== สมัครสมาชิก ==========
        if (this.authMode === 'register') {
            var name = nameEl ? String(nameEl.value || '').trim() : '';
            if (!name) {
                // ถ้ายังไม่กรอกชื่อ ให้โชว์ช่องชื่อแล้วหยุด
                var nameBox = document.getElementById('auth-name-box');
                if (nameBox) nameBox.classList.remove('hidden');
                this.showToast('กรุณากรอกชื่อก่อนสมัครสมาชิก', 'warning');
                if (nameEl) nameEl.focus();
                return false;
            }

            for (var i = 0; i < users.length; i++) {
                if (users[i].email === email) {
                    this.showToast('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ', 'warning');
                    this.authMode = 'login';
                    return false;
                }
            }

            var userObj = new User(email, name, password);
            var newUser = {
                id: userObj.id,
                email: userObj.email,
                name: userObj.name,
                password: userObj.password,
                createdAt: userObj.createdAt
            };
            if (!userObj.checkPassword(password)) return false;
            users.push(newUser);
            if (!this.saveUsers(users)) return false;

            this.currentUser = { email: newUser.email, name: newUser.name };
            try {
                localStorage.setItem('tb_current_user', JSON.stringify(this.currentUser));
            } catch (err) {
                this.showToast('บันทึก session ไม่สำเร็จ', 'error');
                return false;
            }

            var modal = document.getElementById('auth-modal');
            if (modal) modal.classList.add('hidden');
            this.updateUserProfileUI();
            this.renderKanban();
            this.renderCalendar();
            this.renderFriendsList();
            this.updateProfileBadge();
            this.showToast('สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ ' + name, 'success');
            return false;
        }

        // ========== เข้าสู่ระบบ ==========
        var found = null;
        for (var j = 0; j < users.length; j++) {
            if (users[j].email === email) { found = users[j]; break; }
        }

        if (!found) {
            // อีเมลไม่เคยสมัคร → เด้งไปโหมดสมัคร
            this.showToast('ไม่พบบัญชีนี้ กรุณากรอกชื่อแล้วกดสมัครสมาชิก', 'warning');
            this.authMode = 'register';
            var nb = document.getElementById('auth-name-box');
            if (nb) nb.classList.remove('hidden');
            var t = document.getElementById('auth-title');
            if (t) t.innerText = 'สมัครสมาชิก TimeByTime';
            if (emailEl) emailEl.value = email;
            if (nameEl) nameEl.focus();
            return false;
        }

        var loginUser = new User(found.email, found.name, found.password);
        if (!loginUser.checkPassword(password)) {
            this.showToast('รหัสผ่านไม่ถูกต้อง', 'error');
            return false;
        }

        this.currentUser = { email: found.email, name: found.name };
        try {
            localStorage.setItem('tb_current_user', JSON.stringify(this.currentUser));
        } catch (err) {
            this.showToast('บันทึก session ไม่สำเร็จ', 'error');
            return false;
        }

        var modal2 = document.getElementById('auth-modal');
        if (modal2) modal2.classList.add('hidden');
        this.updateUserProfileUI();
        this.renderKanban();
        this.renderCalendar();
        this.renderFriendsList();
        this.updateProfileBadge();
        this.showToast('เข้าสู่ระบบสำเร็จ!', 'success');
        return false;
    }

    handleLogout() {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
            localStorage.removeItem('tb_current_user');
            this.currentUser = null;
            location.reload();
        }
    }
    updateUserProfileUI() {
        const el = document.getElementById('user-display-name');
        if (el && this.currentUser) el.innerText = this.currentUser.name;
    }

    switchView(view) {
        this.activeView = view;
        ['kanban', 'calendar', 'pomodoro', 'team'].forEach(function(v) {
            var viewEl = document.getElementById('view-' + v);
            var navEl = document.getElementById('nav-' + v);
            if (viewEl) viewEl.classList.toggle('hidden', view !== v);
            if (navEl) navEl.classList.toggle('active', view === v);
        });
        if (view === 'calendar') this.renderCalendar();
        if (view === 'team') this.renderFriendsList();
    }

    setBoardType(type) {
        this.activeBoardType = type;
        var bp = document.getElementById('btn-board-personal');
        var bg = document.getElementById('btn-board-group');
        var gc = document.getElementById('group-board-controls');
        if (bp) bp.classList.toggle('active', type === 'personal');
        if (bg) bg.classList.toggle('active', type === 'group');
        if (gc) gc.classList.toggle('hidden', type !== 'group');
        this.renderKanban();
    }

    getFriendRequests() {
        try { return JSON.parse(localStorage.getItem('tb_friend_requests') || '[]'); } catch (e) { return []; }
    }
    saveFriendRequests(list) { localStorage.setItem('tb_friend_requests', JSON.stringify(list)); }
    addFriendBoth(a, b) {
        var keyA = 'tb_friends_' + a,
            keyB = 'tb_friends_' + b;
        var fa = JSON.parse(localStorage.getItem(keyA) || '[]');
        var fb = JSON.parse(localStorage.getItem(keyB) || '[]');
        if (fa.indexOf(b) === -1) fa.push(b);
        if (fb.indexOf(a) === -1) fb.push(a);
        localStorage.setItem(keyA, JSON.stringify(fa));
        localStorage.setItem(keyB, JSON.stringify(fb));
    }
    handleAddFriend(e) {
        e.preventDefault();
        if (!this.currentUser) return;
        const email = document.getElementById('friend-email-input').value.trim().toLowerCase();
        if (!email) return;
        if (!this.getUsers().find(u => u.email === email)) return this.showToast('เพิ่มได้เฉพาะบัญชีที่สมัครแล้วเท่านั้น', 'warning');
        if (email === this.currentUser.email) return this.showToast('ไม่สามารถเพิ่มตัวเองได้', 'warning');
        if (this.getFriends().indexOf(email) !== -1) return this.showToast('เป็นเพื่อนกันอยู่แล้ว', 'warning');
        var reqs = this.getFriendRequests();
        var dup = reqs.find(function(r) {
            return r.status === 'pending' && ((r.fromEmail === this.currentUser.email && r.toEmail === email) || (r.fromEmail === email && r.toEmail === this.currentUser.email));
        }.bind(this));
        if (dup) return this.showToast('มีคำขอที่รอตอบรับอยู่แล้ว', 'warning');
        reqs.push({
            id: 'fr_' + Date.now().toString(36),
            fromEmail: this.currentUser.email,
            fromName: this.currentUser.name,
            toEmail: email,
            status: 'pending'
        });
        this.saveFriendRequests(reqs);
        document.getElementById('friend-email-input').value = '';
        this.renderFriendsList();
        this.updateProfileBadge();
        this.showToast('ส่งคำขอแล้ว ให้เพื่อนออกแล้วล็อกอินบัญชีตัวเอง เปิดเมนูทีม จะเห็นจุดแดง', 'success');
    }
    respondFriendRequest(id, accept) {
        var reqs = this.getFriendRequests();
        var i = reqs.findIndex(function(r) { return r.id === id; });
        if (i === -1) return;
        reqs[i].status = accept ? 'accepted' : 'rejected';
        if (accept) this.addFriendBoth(reqs[i].fromEmail, reqs[i].toEmail);
        this.saveFriendRequests(reqs);
        this.renderFriendsList();
        this.showToast(accept ? 'ยอมรับเป็นเพื่อนแล้ว' : 'ปฏิเสธคำขอแล้ว', 'info');
    }
    removeFriend(email) {
        if (!confirm('ลบ ' + email + ' ออกจากเพื่อน?')) return;
        var me = this.currentUser.email;
        var mine = this.getFriends().filter(function(f) { return f !== email; });
        this.saveFriends(mine);
        var theirs = JSON.parse(localStorage.getItem('tb_friends_' + email) || '[]').filter(function(f) { return f !== me; });
        localStorage.setItem('tb_friends_' + email, JSON.stringify(theirs));
        this.renderFriendsList();
        this.showToast('ลบเพื่อนแล้ว', 'info');
    }
    renderFriendsList() {
        const list = document.getElementById('friends-list');
        if (list) {
            const friends = this.getFriends();
            list.innerHTML = friends.length ? friends.map(email => `
                <div class="flex items-center justify-between p-2.5 bg-white/70 rounded-xl border border-[#c0b59f]/60">
                    <span class="text-xs font-semibold text-[#1f3627]">${this.escapeHtml(email)}</span>
                    <button onclick="app.removeFriend('${email}')" class="text-xs text-red-600 font-bold px-2">ลบ</button>
                </div>`).join('') : '<div class="text-xs text-gray-600 py-3 text-center">ยังไม่มีเพื่อน</div>';
        }
        this.renderFriendRequests();
        this.renderTeamInvitations();
        this.updateTaskFriendSelectOptions();
    }
    renderFriendRequests() {
        var box = document.getElementById('friend-requests-list');
        if (!box || !this.currentUser) return;
        var me = this.currentUser.email;
        var incoming = this.getFriendRequests().filter(function(r) { return r.toEmail === me && r.status === 'pending'; });
        var outgoing = this.getFriendRequests().filter(function(r) { return r.fromEmail === me && r.status === 'pending'; });
        var html = '';
        incoming.forEach(function(r) {
            html += '<div class="p-2.5 bg-white/70 rounded-xl border border-[#c0b59f]/60 space-y-1">' +
                '<div class="text-xs font-semibold">' + this.escapeHtml(r.fromName) + ' (' + this.escapeHtml(r.fromEmail) + ')</div>' +
                '<div class="flex gap-2 justify-end">' +
                '<button onclick="app.respondFriendRequest(\'' + r.id + '\', true)" class="px-3 py-1 bg-[#385441] text-white text-xs rounded-lg">ยอมรับ</button>' +
                '<button onclick="app.respondFriendRequest(\'' + r.id + '\', false)" class="px-3 py-1 bg-gray-200 text-xs rounded-lg">ปฏิเสธ</button>' +
                '</div></div>';
        }.bind(this));
        outgoing.forEach(function(r) {
            html += '<div class="p-2.5 bg-white/50 rounded-xl border border-[#c0b59f]/40 text-xs text-gray-600">ส่งคำขอถึง ' + this.escapeHtml(r.toEmail) + ' แล้ว รอตอบรับ</div>';
        }.bind(this));
        box.innerHTML = html || '<div class="text-xs text-gray-600 py-3 text-center">ไม่มีคำขอเป็นเพื่อน</div>';
    }
    renderTeamInvitations() {
        var box = document.getElementById('team-invitations-list');
        if (!box || !this.currentUser) return;
        var my = this.getInvitations().filter(function(i) { return i.targetEmail === this.currentUser.email && i.status === 'pending'; }.bind(this));
        box.innerHTML = my.length ? my.map(function(inv) {
            return '<div class="p-2.5 bg-white/70 rounded-xl border border-[#c0b59f]/60 space-y-1">' +
                '<div class="text-xs font-bold">' + this.escapeHtml(inv.taskTitle) + '</div>' +
                '<div class="text-[10px] text-gray-600">จาก ' + this.escapeHtml(inv.senderEmail) + ' | บอร์ด ' + this.escapeHtml(inv.boardName || '') + '</div>' +
                '<div class="flex gap-2 justify-end">' +
                '<button onclick="app.respondInvitation(\'' + inv.id + '\', \'accepted\')" class="px-3 py-1 bg-[#385441] text-white text-xs rounded-lg">ยอมรับ</button>' +
                '<button onclick="app.respondInvitation(\'' + inv.id + '\', \'rejected\')" class="px-3 py-1 bg-gray-200 text-xs rounded-lg">ปฏิเสธ</button>' +
                '</div></div>';
        }.bind(this)).join('') : '<div class="text-xs text-gray-600 py-3 text-center">ไม่มีคำเชิญบอร์ด</div>';
    }
    updateTaskFriendSelectOptions() {
        const select = document.getElementById('task-friend-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- เลือกเพื่อน --</option>' +
            this.getFriends().map(e => `<option value="${e}">${e}</option>`).join('');
    }

    openProfileModal() {
        if (!this.currentUser) return;
        document.getElementById('profile-modal-name').innerText = this.currentUser.name;
        document.getElementById('profile-modal-email').innerText = this.currentUser.email;
        this.renderProfileInvitations();
        document.getElementById('profile-modal').classList.remove('hidden');
    }
    closeProfileModal() { document.getElementById('profile-modal').classList.add('hidden'); }
    renderProfileInvitations() {
        const list = document.getElementById('profile-invitations-list');
        if (!list) return;
        const my = this.getInvitations().filter(i => i.targetEmail === this.currentUser.email && i.status === 'pending');
        list.innerHTML = my.length ? my.map(inv => `
            <div class="p-3 bg-white rounded-xl border border-[#c0b59f] space-y-2">
                <h5 class="text-xs font-bold">${this.escapeHtml(inv.taskTitle)}</h5>
                <p class="text-[10px] text-gray-500">จาก: ${this.escapeHtml(inv.senderEmail)}</p>
                <div class="flex gap-2 justify-end">
                    <button onclick="app.respondInvitation('${inv.id}','accepted')" class="px-3 py-1 bg-[#385441] text-white text-xs rounded-lg">ยอมรับ</button>
                    <button onclick="app.respondInvitation('${inv.id}','rejected')" class="px-3 py-1 bg-gray-200 text-xs rounded-lg">ปฏิเสธ</button>
                </div>
            </div>`).join('') : '<div class="text-xs text-gray-500 py-3 text-center">ไม่มีคำเชิญ</div>';
    }
    respondInvitation(id, status) {
        const invites = this.getInvitations();
        const i = invites.findIndex(x => x.id === id);
        if (i !== -1) { invites[i].status = status;
            this.saveInvitations(invites); }
        this.renderProfileInvitations();
        this.updateProfileBadge();
        this.renderKanban();
        this.showToast(status === 'accepted' ? 'ตอบรับแล้ว' : 'ปฏิเสธแล้ว', 'info');
    }
    updateProfileBadge() {
        if (!this.currentUser) return;
        const n = this.getInvitations().filter(i => i.targetEmail === this.currentUser.email && i.status === 'pending').length;
        const badge = document.getElementById('profile-invite-badge');
        if (badge) badge.classList.toggle('hidden', n === 0);
        var fr = this.getFriendRequests().filter(function(r) { return r.toEmail === this.currentUser.email && r.status === 'pending'; }.bind(this)).length;
        var teamBadge = document.getElementById('team-request-badge');
        var total = n + fr;
        if (teamBadge) {
            teamBadge.innerText = String(total);
            teamBadge.classList.toggle('hidden', total === 0);
        }
    }

    renderKanban() {
        if (!this.currentUser) return;
        const userEmail = this.currentUser.email;
        let filtered = this.getTasks().filter(t => {
            if (this.activeBoardType === 'personal') return t.type === 'personal' && t.userEmail === userEmail;
            const ok = t.userEmail === userEmail || (t.taggedEmails || []).includes(userEmail);
            return ok && (!this.activeGroup || t.boardName === this.activeGroup);
        });
        const cols = { todo: [], doing: [], done: [] };
        filtered.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });
        ['todo', 'doing', 'done'].forEach(st => {
            const c = document.getElementById('col-' + st),
                b = document.getElementById('badge-' + st);
            if (!c) return;
            c.innerHTML = '';
            if (b) b.innerText = cols[st].length;
            cols[st].forEach(t => c.appendChild(this.createTaskCard(t)));
        });
        this.updateGroupSelectOptions();
    }

    createTaskCard(task) {
            const card = document.createElement('div');
            card.className = 'p-3 bg-white rounded-xl border border-[#c0b59f] shadow-sm hover:shadow-md cursor-pointer space-y-1.5';
            card.onclick = () => this.openEditTaskModal(task.id);
            const pri = { low: ['bg-emerald-100 text-emerald-800', 'ทั่วไป'], medium: ['bg-amber-100 text-amber-800', 'ปานกลาง'], high: ['bg-red-100 text-red-800', 'ด่วน'] };
            const [pc, pt] = pri[task.priority] || pri.medium;
            let plans = '';
            if (task.dailyPlans && task.dailyPlans.length) {
                plans = `<div class="mt-2 pt-2 border-t border-gray-100 space-y-1"><div class="text-[9px] font-bold text-[#385441]">แผน AI:</div>` +
                    task.dailyPlans.slice(0, 3).map(p => `<div class="text-[9px] text-gray-600 truncate">• ${p.date}: ${this.escapeHtml(p.description)}</div>`).join('') +
                    (task.dailyPlans.length > 3 ? `<div class="text-[9px] text-gray-400">+ อีก ${task.dailyPlans.length - 3}</div>` : '') + '</div>';
            }
            card.innerHTML = `<div class="flex justify-between"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${pc}">${pt}</span>
            ${task.dueDate ? `<span class="text-[10px] text-gray-500">${task.dueDate}</span>` : ''}</div>
            <h4 class="text-xs font-bold text-[#1f3627] truncate">${this.escapeHtml(task.title)}</h4>
            ${task.boardName ? `<div class="text-[9px] text-[#385441] bg-[#e0d8c7] inline-block px-1.5 py-0.5 rounded font-bold">${this.escapeHtml(task.boardName)}</div>` : ''}
            ${plans}`;
        return card;
    }

    updateGroupSelectOptions() {
        const select = document.getElementById('group-select'), modal = document.getElementById('task-board-name');
        if (!select) return;
        const userEmail = this.currentUser.email, groups = new Set();
        this.getTasks().forEach(t => {
            if (t.type === 'group' && t.boardName && (t.userEmail === userEmail || (t.taggedEmails || []).includes(userEmail))) groups.add(t.boardName);
        });
        select.innerHTML = '<option value="">-- บอร์ดกลุ่มทั้งหมด --</option>';
        if (modal) modal.innerHTML = '<option value="งานกลุ่มทั่วไป">งานกลุ่มทั่วไป</option>';
        groups.forEach(g => {
            select.appendChild(new Option(g, g));
            if (modal) modal.appendChild(new Option(g, g));
        });
    }
    handleGroupChange(v) { this.activeGroup = v; this.renderKanban(); }
    addNewGroupBoard() {
        const name = prompt('ชื่อบอร์ดกลุ่มใหม่:');
        if (!name || !String(name).trim()) return;
        this.activeGroup = name.trim(); this.updateGroupSelectOptions();
        document.getElementById('group-select').value = this.activeGroup;
        this.renderKanban(); this.showToast(`สร้างบอร์ด "${this.activeGroup}" สำเร็จ`, 'success');
    }

    openTaskModal() {
        ['task-id', 'task-title', 'task-start-date', 'task-due-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('task-priority').value = 'medium';
        document.getElementById('task-status').value = 'todo';
        document.getElementById('task-type').value = this.activeBoardType;
        document.getElementById('task-use-ai').checked = false;
        this.currentTaskMembers = []; this.renderTaskTaggedMembers(); this.updateTaskFriendSelectOptions();
        this.toggleTaskTypeFields(this.activeBoardType);
        var ocrPrev = document.getElementById('ocr-result-preview');
        var delBtn = document.getElementById('btn-delete-task');
        if (ocrPrev) ocrPrev.classList.add('hidden');
        if (delBtn) delBtn.classList.add('hidden');
        document.getElementById('task-modal').classList.remove('hidden');
    }
    openEditTaskModal(id) {
        const task = this.getTasks().find(t => t.id === id); if (!task) return;
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-start-date').value = task.startDate || '';
        document.getElementById('task-due-date').value = task.dueDate || '';
        document.getElementById('task-priority').value = task.priority || 'medium';
        document.getElementById('task-status').value = task.status || 'todo';
        document.getElementById('task-type').value = task.type || 'personal';
        document.getElementById('task-use-ai').checked = !!task.useAI;
        this.currentTaskMembers = task.taggedEmails || [];
        this.renderTaskTaggedMembers(); this.updateTaskFriendSelectOptions();
        this.toggleTaskTypeFields(task.type || 'personal');
        if (task.type === 'group' && task.boardName) {
            const s = document.getElementById('task-board-name'); if (s) s.value = task.boardName;
        }
        var delBtn2 = document.getElementById('btn-delete-task');
        if (delBtn2) delBtn2.classList.remove('hidden');
        document.getElementById('task-modal').classList.remove('hidden');
    }
    closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
    toggleTaskTypeFields(type) {
        var gBox = document.getElementById('task-group-board-select-box');
        var tBox = document.getElementById('task-tag-friend-box');
        if (gBox) gBox.classList.toggle('hidden', type !== 'group');
        if (tBox) tBox.classList.toggle('hidden', type !== 'group');
    }
    addMemberToCurrentTask() {
        var friendSel = document.getElementById('task-friend-select');
        const email = friendSel ? friendSel.value : '';
        if (!email) return;
        if (this.currentTaskMembers.includes(email)) return this.showToast('แท็กแล้ว', 'warning');
        this.currentTaskMembers.push(email); this.renderTaskTaggedMembers();
        document.getElementById('task-friend-select').value = '';
    }
    removeMemberFromCurrentTask(email) {
        this.currentTaskMembers = this.currentTaskMembers.filter(m => m !== email);
        this.renderTaskTaggedMembers();
    }
    renderTaskTaggedMembers() {
        const c = document.getElementById('task-tagged-members-list'); if (!c) return;
        c.innerHTML = this.currentTaskMembers.length
            ? this.currentTaskMembers.map(e => `<div class="flex justify-between bg-white px-2 py-1 rounded border text-[10px]">
                <span>${this.escapeHtml(e)}</span>
                <button type="button" onclick="app.removeMemberFromCurrentTask('${e}')" class="text-red-600 font-bold">x</button></div>`).join('')
            : '<div class="text-[10px] text-gray-500 italic">ยังไม่มีสมาชิก</div>';
    }

    handleTaskSubmit(e) {
        e.preventDefault(); if (!this.currentUser) return;
        const taskId = document.getElementById('task-id').value;
        const title = document.getElementById('task-title').value.trim(); if (!title) return;
        const startDate = document.getElementById('task-start-date').value;
        const dueDate = document.getElementById('task-due-date').value;
        const priority = document.getElementById('task-priority').value;
        const status = document.getElementById('task-status').value;
        const type = document.getElementById('task-type').value;
        const useAI = document.getElementById('task-use-ai').checked;
        const userEmail = this.currentUser.email;
        let allTasks = this.getTasks();
        var boardEl = document.getElementById('task-board-name');
        const boardName = type === 'group' ? (boardEl ? boardEl.value : null) : null;
        const data = { title, startDate, dueDate, time: '', location: '', priority, status, type, userEmail, boardName, taggedEmails: this.currentTaskMembers, useAI };
        let taskObj = type === 'group' ? new GroupTask(data) : new PersonalTask(data);
        taskObj.dailyPlans = (useAI && startDate && dueDate) ? AIScheduler.createDailyPlans(taskObj) : [];
        if (useAI && startDate && dueDate) this.showToast('AI กำลังจัดสรรวัน...', 'info');

        if (taskId) {
            const idx = allTasks.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                taskObj.id = taskId; taskObj.createdAt = allTasks[idx].createdAt;
                taskObj.updatedAt = new Date().toISOString(); allTasks[idx] = taskObj;
            }
        } else {
            allTasks.push(taskObj);
            if (type === 'group' && this.currentTaskMembers.length) {
                let inv = this.getInvitations();
                this.currentTaskMembers.forEach(target => {
                    if (target !== userEmail) inv.push({
                        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                        taskId: taskObj.id, taskTitle: title, boardName: boardName || 'งานกลุ่มทั่วไป',
                        senderEmail: userEmail, targetEmail: target, status: 'pending'
                    });
                });
                this.saveInvitations(inv);
            }
        }

        let pulled = false;
        if (status === 'done' && dueDate) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
            if (today < due) {
                const next = allTasks.filter(t => t.id !== taskObj.id && t.status !== 'done' && (t.startDate || t.dueDate));
                if (next.length) {
                    const daysEarly = Math.round((due - today) / 86400000);
                    if (confirm(`งานนี้เสร็จก่อนกำหนด ~${daysEarly} วัน\n\nเลื่อนตารางงานถัดไปขึ้นไหม?\nตกลง = เลื่อนขึ้น | ยกเลิก = คงเดิม`)) {
                        allTasks = this.pullUpNextTasks(taskObj, allTasks, daysEarly); pulled = true;
                    }
                }
            }
        }

        this.saveTasks(allTasks); this.closeTaskModal(); this.renderKanban(); this.renderCalendar();
        this.showToast(pulled ? 'เลื่อนตารางงานถัดไปแล้ว' : (taskId ? 'แก้ไขเรียบร้อย' : 'เพิ่มงานสำเร็จ'), 'success');
    }

    pullUpNextTasks(completed, allTasks, daysEarly) {
        if (!daysEarly || daysEarly <= 0) return allTasks;
        const shift = (d) => { if (!d) return d; const x = new Date(d); x.setDate(x.getDate() - daysEarly); return x.toISOString().slice(0, 10); };
        return allTasks.map(t => {
            if (t.id === completed.id || t.status === 'done' || !(t.startDate || t.dueDate)) return t;
            const u = { ...t };
            if (u.startDate) u.startDate = shift(u.startDate);
            if (u.dueDate) u.dueDate = shift(u.dueDate);
            if (u.dailyPlans && u.dailyPlans.length) u.dailyPlans = u.dailyPlans.map(function(p) { return Object.assign({}, p, { date: shift(p.date) }); });
            return u;
        });
    }

    deleteTask(id) {
        if (!confirm('ลบงานนี้?')) return;
        const tid = id || document.getElementById('task-id').value; if (!tid) return;
        this.saveTasks(this.getTasks().filter(t => t.id !== tid));
        this.closeTaskModal(); this.renderKanban(); this.renderCalendar();
        this.showToast('ลบงานแล้ว', 'info');
    }

    handleImageOCRAndLocation(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (isPdf) return this.scanPdfFile(file);
        this.fillScanResult('งานสแกน: ' + file.name.replace(/\.[^.]+$/, ''), 'อ่านไฟล์สำเร็จ', file.name + ' (' + Math.ceil(file.size / 1024) + ' KB)');
        this.showToast('สแกนไฟล์สำเร็จ', 'success');
    }
    scanPdfFile(file) {
        var self = this;
        if (typeof pdfjsLib === 'undefined') {
            this.showToast('ยังไม่ได้โหลดตัวอ่าน PDF', 'error');
            return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        this.showToast('กำลังดึงข้อความจาก PDF...', 'info');
        var reader = new FileReader();
        reader.onload = function () {
            pdfjsLib.getDocument({ data: reader.result }).promise.then(function (pdf) {
                var jobs = [];
                var maxPages = Math.min(pdf.numPages, 5);
                for (var i = 1; i <= maxPages; i++) {
                    jobs.push(pdf.getPage(i).then(function (page) {
                        return page.getTextContent().then(function (content) {
                            return content.items.map(function (item) { return item.str; }).join(' ');
                        });
                    }));
                }
                return Promise.all(jobs).then(function (pages) {
                    var text = pages.join('\n').replace(/\s+/g, ' ').trim();
                    if (!text || text.length < 8) {
                        self.showToast('PDF เป็นภาพ กำลัง OCR...', 'info');
                        return self.ocrPdfPages(pdf, file);
                    }
                    var titleEl = document.getElementById('task-title');
                    var firstLine = text.slice(0, 80);
                    if (titleEl && !titleEl.value) titleEl.value = firstLine;
                    self.fillScanResult(titleEl ? titleEl.value : firstLine, 'ดึงข้อความจาก PDF ได้ ' + maxPages + ' หน้า', text.slice(0, 400));
                    self.showToast('ดึงข้อความจาก PDF สำเร็จ', 'success');
                });
            }).catch(function () {
                self.showToast('อ่าน PDF ไม่สำเร็จ', 'error');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    ocrPdfPages(pdf, file) {
        var self = this;
        if (typeof Tesseract === 'undefined') {
            this.showToast('ยังไม่ได้โหลดตัว OCR', 'error');
            return;
        }
        var maxPages = Math.min(pdf.numPages, 2);
        var chain = Promise.resolve('');
        for (var i = 1; i <= maxPages; i++) {
            (function (pageNo) {
                chain = chain.then(function (acc) {
                    return pdf.getPage(pageNo).then(function (page) {
                        var viewport = page.getViewport({ scale: 1.6 });
                        var canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
                            return Tesseract.recognize(canvas, 'tha+eng', {
                                logger: function (m) {
                                    if (m.status === 'recognizing text') self.showToast('OCR หน้า ' + pageNo + ' ' + Math.round((m.progress || 0) * 100) + '%', 'info');
                                }
                            }).then(function (res) {
                                return (acc + ' ' + (res.data.text || '')).trim();
                            });
                        });
                    });
                });
            })(i);
        }
        chain.then(function (text) {
            text = String(text || '').replace(/\s+/g, ' ').trim();
            if (!text) {
                self.showToast('OCR ไม่พบตัวอักษรในภาพ', 'warning');
                self.fillScanResult('งานสแกน: ' + file.name.replace(/\.pdf$/i, ''), 'OCR ไม่พบข้อความ', file.name);
                return;
            }
            var titleEl = document.getElementById('task-title');
            var firstLine = text.slice(0, 80);
            if (titleEl && !titleEl.value) titleEl.value = firstLine;
            self.fillScanResult(firstLine, 'OCR จาก PDF ภาพได้ ' + maxPages + ' หน้า', text.slice(0, 400));
            self.showToast('OCR สำเร็จ', 'success');
        }).catch(function () {
            self.showToast('OCR ไม่สำเร็จ', 'error');
        });
    }
    fillScanResult(title, descText, infoText) {
        var titleEl = document.getElementById('task-title');
        var priority = document.getElementById('task-priority');
        if (titleEl && !titleEl.value) titleEl.value = title;
        if (priority) priority.value = 'high';
        var desc = document.getElementById('ocr-desc');
        var info = document.getElementById('ocr-location-info');
        var prev = document.getElementById('ocr-result-preview');
        if (desc) desc.innerText = descText;
        if (info) info.innerText = infoText;
        if (prev) prev.classList.remove('hidden');
    }
    scanFromUrl() {
        var input = document.getElementById('task-scan-url');
        var raw = input ? String(input.value || '').trim() : '';
        if (!raw) return this.showToast('วางลิงก์ก่อน', 'warning');
        var title = document.getElementById('task-title');
        var clean = raw.split('?')[0].split('/').filter(Boolean).pop() || raw;
        try { clean = decodeURIComponent(clean); } catch (err) {}
        clean = clean.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
        if (title && !title.value) title.value = 'งานจากลิงก์: ' + clean;
        var desc = document.getElementById('ocr-desc');
        var info = document.getElementById('ocr-location-info');
        var prev = document.getElementById('ocr-result-preview');
        if (desc) desc.innerText = 'อ่านลิงก์สำเร็จ';
        if (info) info.innerText = raw;
        if (prev) prev.classList.remove('hidden');
        this.showToast('สแกนลิงก์สำเร็จ', 'success');
    }

    renderCalendar() {
        const grid = document.getElementById('calendar-days-grid'), title = document.getElementById('calendar-month-year');
        if (!grid || !title || !this.currentUser) return;
        grid.innerHTML = '';
        const y = this.currentCalendarDate.getFullYear(), m = this.currentCalendarDate.getMonth();
        const names = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        title.innerText = `${names[m]} ${y + 543}`;
        const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < first; i++) {
            const e = document.createElement('div'); e.className = 'h-24 bg-[#e0d8c7]/40 rounded-xl'; grid.appendChild(e);
        }
        const tasks = this.getTasks();
        for (let d = 1; d <= days; d++) {
            const cell = document.createElement('div');
            cell.className = 'h-24 bg-white p-2 rounded-xl border border-[#c0b59f] overflow-y-auto space-y-1';
            const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cell.innerHTML = `<div class="text-xs font-bold mb-1">${d}</div>`;
            tasks.forEach(t => {
                const hit = t.dueDate === ds || (t.dailyPlans && t.dailyPlans.some(function(p) { return p.date === ds; }));
                if (!hit) return;
                const el = document.createElement('div');
                el.className = 'text-[9px] bg-[#385441] text-white p-1 rounded truncate cursor-pointer';
                var planHit = t.dailyPlans && t.dailyPlans.find(function(p) { return p.date === ds; });
                el.innerText = (planHit && planHit.description) ? planHit.description : t.title;
                el.onclick = (ev) => { ev.stopPropagation(); this.openEditTaskModal(t.id); };
                cell.appendChild(el);
            });
            grid.appendChild(cell);
        }
    }
    changeMonth(off) { this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + off); this.renderCalendar(); }
    goToday() { this.currentCalendarDate = new Date(); this.renderCalendar(); }

    setTimerMode(mode) {
        this.timerMode = mode;
        this.stopTimer();
        if (mode === 'elapsed') this.timerTimeLeft = 0;
        else this.timerTimeLeft = this.getTimerSeconds(mode);
        ['work', 'short', 'long', 'elapsed'].forEach(function (m) {
            var btn = document.getElementById('btn-pomo-' + m);
            var key = m === 'short' ? 'shortBreak' : m === 'long' ? 'longBreak' : m;
            if (btn) btn.className = mode === key ? 'px-3 py-1 bg-[#385441] text-white rounded-lg text-xs font-bold' : 'px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold';
        });
        this.updateTimerDisplay();
    }
    getTimerSeconds(mode) {
        var id = mode === 'work' ? 'pomo-min-work' : mode === 'shortBreak' ? 'pomo-min-short' : 'pomo-min-long';
        var el = document.getElementById(id);
        var mins = el ? parseInt(el.value, 10) : 0;
        if (!mins || mins < 1) mins = mode === 'work' ? 25 : mode === 'shortBreak' ? 5 : 15;
        return mins * 60;
    }
    applyCustomTime() {
        if (this.timerMode === 'elapsed') return this.showToast('โหมดนับเวลาทำงานไม่ต้องตั้งนาที', 'info');
        this.timerTimeLeft = this.getTimerSeconds(this.timerMode);
        this.updateTimerDisplay();
        this.showToast('ตั้งเวลาแล้ว', 'success');
    }
    toggleTimer() { this.isTimerRunning ? this.stopTimer() : this.startTimer(); }
    startTimer() {
        this.isTimerRunning = true;
        var btn = document.getElementById('btn-pomo-start');
        if (btn) btn.innerText = 'พักการนับเวลา';
        var self = this;
        this.timerInterval = setInterval(function () {
            if (self.timerMode === 'elapsed') {
                self.timerTimeLeft++;
                self.updateTimerDisplay();
                return;
            }
            if (self.timerTimeLeft > 0) { self.timerTimeLeft--; self.updateTimerDisplay(); }
            else { self.stopTimer(); self.showToast('หมดเวลา!', 'warning'); }
        }, 1000);
    }
    stopTimer() {
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
        var btn = document.getElementById('btn-pomo-start');
        if (btn) btn.innerText = 'เริ่มจับเวลา';
    }
    resetTimer() { this.setTimerMode(this.timerMode); }
    updateTimerDisplay() {
        var total = this.timerTimeLeft || 0;
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        var el = document.getElementById('pomo-display');
        var text = (h > 0 ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        if (el) el.innerText = text;
        var label = document.getElementById('pomo-mode-label');
        if (label) label.innerText = this.timerMode === 'elapsed' ? 'ทำงานไปแล้ว' : 'เหลือเวลา';
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    showToast(msg, type = 'info') {
        const t = document.getElementById('toast'); if (!t) return;
        const colors = { success: 'bg-[#385441] text-white', warning: 'bg-amber-600 text-white', info: 'bg-[#2d4735] text-white', error: 'bg-red-700 text-white' };
        t.className = `fixed bottom-5 right-5 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium z-50 ${colors[type] || colors.info}`;
        t.innerText = msg; t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => { app = new App(); });
window.addEventListener('DOMContentLoaded', () => { app = new App(); });