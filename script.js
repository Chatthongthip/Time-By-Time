class Entity {
    constructor(id = null) {
        this.id = id || this.generateId();
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
}

class User extends Entity {
    constructor(email, name, password, username) {
        super();
        this.email = email.toLowerCase().trim();
        this.name = name.trim();
        this.password = password;
        this.username = String(username || '').trim().replace(/^@+/, '');
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
    getDisplayType() { return 'งานส่วนตัว'; }
}

class GroupTask extends Task {
    constructor(data = {}) {
        super(Object.assign({}, data, { type: 'group' }));
        this.boardName = data.boardName || 'งานกลุ่มทั่วไป';
        this.taggedEmails = data.taggedEmails || [];
    }
    getDisplayType() { return 'งานกลุ่ม: ' + this.boardName; }
    addMember(email) {
        if (!this.taggedEmails.includes(email)) this.taggedEmails.push(email);
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
            try {
                this.migrateUserData();
                this.renderKanban();
                this.renderCalendar();
                this.updateGroupSelectOptions();
                this.renderFriendsList();
                this.updateProfileBadge();
                this.updateUserProfileUI();
                this.persistSession();
            } catch (err) {
                console.error(err);
                this.showToast('โหลดข้อมูลไม่สำเร็จ แต่ยังล็อกอินได้', 'warning');
            }
        }
        var self = this;
        window.addEventListener('pagehide', function() { self.persistSession(); });
        window.addEventListener('beforeunload', function() { self.persistSession(); });
    }

    getUsers() {
        try {
            var raw = localStorage.getItem('tb_users');
            var data = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(data)) data = [];
            return data.map(function(u) {
                if (!u) return u;
                u.email = String(u.email || '').trim().toLowerCase();
                return u;
            }).filter(function(u) { return u && u.email; });
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
    getTasks() {
        if (!this.currentUser) return [];
        try {
            var data = JSON.parse(localStorage.getItem('tb_tasks_' + this.normEmail(this.currentUser.email)) || '[]');
            return Array.isArray(data) ? data : [];
        } catch (e) { return []; }
    }
    saveTasks(t) {
        if (!this.currentUser) return;
        localStorage.setItem('tb_tasks_' + this.normEmail(this.currentUser.email), JSON.stringify(t));
        this.persistSession();
    }
    getFriends() {
        if (!this.currentUser) return [];
        try {
            var data = JSON.parse(localStorage.getItem('tb_friends_' + this.normEmail(this.currentUser.email)) || '[]');
            return Array.isArray(data) ? data : [];
        } catch (e) { return []; }
    }
    saveFriends(f) {
        if (!this.currentUser) return;
        localStorage.setItem('tb_friends_' + this.normEmail(this.currentUser.email), JSON.stringify(f));
    }
    getInvitations() { return JSON.parse(localStorage.getItem('tb_invitations') || '[]'); }
    saveInvitations(i) { localStorage.setItem('tb_invitations', JSON.stringify(i)); }
    getGroupBoards() {
        if (!this.currentUser) return [];
        try {
            var raw = JSON.parse(localStorage.getItem('tb_boards_' + this.normEmail(this.currentUser.email)) || '[]');
            return Array.isArray(raw) ? raw.filter(function(n) { return !!n; }) : [];
        } catch (e) { return []; }
    }
    saveGroupBoards(list) {
        if (!this.currentUser) return;
        localStorage.setItem('tb_boards_' + this.normEmail(this.currentUser.email), JSON.stringify(list));
    }
    ensureGroupBoard(name) {
        var n = String(name || '').trim();
        if (!n || !this.currentUser) return n;
        var list = this.getGroupBoards();
        if (list.indexOf(n) === -1) {
            list.push(n);
            this.saveGroupBoards(list);
        }
        return n;
    }
    normEmail(v) { return String(v || '').trim().toLowerCase(); }
    findUsers(query) {
        var q = this.normEmail(query);
        if (!q) return [];
        var users = this.getUsers();
        var exact = [];
        var fuzzy = [];
        for (var i = 0; i < users.length; i++) {
            var email = this.normEmail(users[i].email);
            if (email === q) exact.push(users[i]);
            else if (email.indexOf(q) !== -1) fuzzy.push(users[i]);
        }
        return exact.length ? exact : fuzzy;
    }
    findUser(query) {
        var list = this.findUsers(query);
        return list.length ? list[0] : null;
    }
    persistSession() {
        if (!this.currentUser) return;
        this.currentUser.email = this.normEmail(this.currentUser.email);
        var rememberEl = document.getElementById('auth-remember');
        var remember = !rememberEl || rememberEl.checked !== false;
        localStorage.setItem('tb_last_email', this.currentUser.email);
        if (this.currentUser.name) localStorage.setItem('tb_last_name', this.currentUser.name);
        var raw = JSON.stringify({
            email: this.currentUser.email,
            name: this.currentUser.name,
            username: this.currentUser.username || ''
        });
        if (remember) {
            localStorage.setItem('tb_current_user', raw);
            sessionStorage.removeItem('tb_current_user');
        } else {
            sessionStorage.setItem('tb_current_user', raw);
            localStorage.removeItem('tb_current_user');
        }
    }
    migrateUserData() {
        if (!this.currentUser) return;
        var email = this.normEmail(this.currentUser.email);
        this.currentUser.email = email;
        var prefixes = ['tb_tasks_', 'tb_friends_', 'tb_boards_'];
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        for (var p = 0; p < prefixes.length; p++) {
            var prefix = prefixes[p];
            var target = prefix + email;
            var merged = [];
            try { merged = JSON.parse(localStorage.getItem(target) || '[]'); } catch (e) { merged = []; }
            if (!Array.isArray(merged)) merged = [];
            keys.forEach(function(k) {
                if (!k || k.indexOf(prefix) !== 0) return;
                var keyEmail = String(k.slice(prefix.length) || '').trim().toLowerCase();
                try {
                    var extra = JSON.parse(localStorage.getItem(k) || '[]');
                    if (!Array.isArray(extra)) return;
                    extra.forEach(function(item) {
                        if (prefix === 'tb_tasks_') {
                            var owner = String((item && item.userEmail) || '').trim().toLowerCase();
                            if (owner !== email && keyEmail !== email) return;
                            if (item && item.id && !merged.some(function(t) { return t && t.id === item.id; })) merged.push(item);
                        } else if (keyEmail === email && merged.indexOf(item) === -1) {
                            merged.push(item);
                        }
                    });
                } catch (err) {}
            });
            localStorage.setItem(target, JSON.stringify(merged));
        }
    }
    afterLoginSuccess(msg) {
        this.persistSession();
        this.migrateUserData();
        var modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');
        this.updateUserProfileUI();
        this.renderKanban();
        this.renderCalendar();
        this.updateGroupSelectOptions();
        this.renderFriendsList();
        this.updateProfileBadge();
        this.showToast(msg, 'success');
    }
    loadCurrentUser() {
        try {
            var s = localStorage.getItem('tb_current_user') || sessionStorage.getItem('tb_current_user');
            if (s) {
                this.currentUser = JSON.parse(s);
                if (this.currentUser && this.currentUser.email) this.currentUser.email = this.normEmail(this.currentUser.email);
                else this.currentUser = null;
            }
        } catch (e) { this.currentUser = null; }
    }
    checkAuth() {
        const m = document.getElementById('auth-modal');
        if (!this.currentUser) {
            if (m) m.classList.remove('hidden');
            var last = localStorage.getItem('tb_last_email');
            var emailEl = document.getElementById('auth-email');
            if (last && emailEl && !emailEl.value) emailEl.value = last;
            this.renderSavedAccounts();
        } else {
            if (m) m.classList.add('hidden');
            this.migrateUserData();
        }
    }
    renderSavedAccounts() {
        var box = document.getElementById('saved-accounts-box');
        if (!box) return;
        var users = this.getUsers();
        if (!users.length) {
            box.innerHTML = 'ยังไม่มีบัญชีบนเครื่องนี้ กดสมัครสมาชิกก่อน';
            return;
        }
        var html = 'บัญชีบนเครื่องนี้ (กดเพื่อกรอกอัตโนมัติ): ';
        users.forEach(function(u, idx) {
            html += (idx ? ' , ' : '') + '<button type="button" class="underline text-[#385441]" onclick="app.fillLoginAccount(\'' + this.escapeHtml(u.email) + '\')">' + this.escapeHtml(u.name || u.email) + '</button>';
        }.bind(this));
        box.innerHTML = html;
    }
    fillLoginAccount(email) {
        var emailEl = document.getElementById('auth-email');
        if (emailEl) emailEl.value = email;
        this.authMode = 'login';
        var nameBox = document.getElementById('auth-name-box');
        var userBox = document.getElementById('auth-username-box');
        if (nameBox) nameBox.classList.add('hidden');
        if (userBox) userBox.classList.add('hidden');
        var passEl = document.getElementById('auth-password');
        if (passEl) passEl.focus();
    }
    switchAuthMode(mode) {
        this.authMode = mode;
        var isReg = mode === 'register';
        var modal = document.getElementById('auth-modal');
        if (modal) modal.classList.remove('hidden');
        var title = document.getElementById('auth-title');
        var desc = document.getElementById('auth-desc-text');
        var nameBox = document.getElementById('auth-name-box');
        var userBox = document.getElementById('auth-username-box');
        if (title) title.innerText = isReg ? 'สมัครสมาชิก TimeByTime' : 'เข้าสู่ระบบ TimeByTime';
        if (desc) desc.innerText = isReg ? 'กรอกชื่อ อีเมล และรหัสผ่านเพื่อสร้างบัญชีใหม่' : 'กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน';
        if (nameBox) {
            if (isReg) nameBox.classList.remove('hidden');
            else nameBox.classList.add('hidden');
        }
        if (userBox) userBox.classList.add('hidden');
    }
    doLogin() {
        this.authMode = 'login';
        var nameBox = document.getElementById('auth-name-box');
        if (nameBox) nameBox.classList.add('hidden');
        var userBox = document.getElementById('auth-username-box');
        if (userBox) userBox.classList.add('hidden');
        var title = document.getElementById('auth-title');
        if (title) title.innerText = 'เข้าสู่ระบบ TimeByTime';
        this.handleAuthSubmit();
    }
    doRegister() {
        this.authMode = 'register';
        var nameBox = document.getElementById('auth-name-box');
        var nameEl = document.getElementById('auth-name');
        var title = document.getElementById('auth-title');
        if (title) title.innerText = 'สมัครสมาชิก TimeByTime';
        if (nameBox) nameBox.classList.remove('hidden');
        var userBox = document.getElementById('auth-username-box');
        if (userBox) userBox.classList.add('hidden');
        if (!nameEl || !String(nameEl.value || '').trim()) {
            this.showToast('กรอกชื่อ แล้วกดสมัครสมาชิกอีกครั้ง', 'warning');
            if (nameEl) nameEl.focus();
            return;
        }
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
        if (this.authMode === 'register') {
            var name = nameEl ? String(nameEl.value || '').trim() : '';
            if (!name) {
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
                username: userObj.username || '',
                password: userObj.password,
                createdAt: userObj.createdAt
            };
            if (!userObj.checkPassword(password)) return false;
            users.push(newUser);
            if (!this.saveUsers(users)) return false;
            this.currentUser = { email: newUser.email, name: newUser.name, username: newUser.username || '' };
            this.afterLoginSuccess('สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ ' + name);
            return false;
        }
        var found = null;
        for (var j = 0; j < users.length; j++) {
            if (users[j].email === email) { found = users[j]; break; }
        }
        if (!found) {
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
        this.currentUser = { email: found.email, name: found.name, username: found.username || '' };
        this.afterLoginSuccess('เข้าสู่ระบบสำเร็จ!');
        return false;
    }
    showForgot() {
        var box = document.getElementById('forgot-box');
        if (box) box.classList.remove('hidden');
        var email = document.getElementById('auth-email');
        var target = document.getElementById('forgot-email');
        if (email && target && email.value) target.value = email.value;
    }
    sendResetCode() {
        var emailEl = document.getElementById('forgot-email');
        var email = emailEl ? String(emailEl.value || '').trim().toLowerCase() : '';
        var users = this.getUsers();
        var found = null;
        for (var i = 0; i < users.length; i++)
            if (users[i].email === email) found = users[i];
        if (!found) return this.showToast('ไม่พบบัญชีนี้ในระบบ', 'warning');
        var code = String(Math.floor(100000 + Math.random() * 900000));
        var resets = {};
        try { resets = JSON.parse(localStorage.getItem('tb_resets') || '{}'); } catch (e) {}
        resets[email] = { code: code, exp: Date.now() + 10 * 60 * 1000 };
        localStorage.setItem('tb_resets', JSON.stringify(resets));
        var subject = encodeURIComponent('รหัสสำรอง TimeByTime');
        var body = encodeURIComponent('รหัสสำรองของคุณคือ ' + code + ' ใช้ได้ 10 นาที');
        window.open('mailto:' + email + '?subject=' + subject + '&body=' + body);
        var codeEl = document.getElementById('forgot-code');
        var verifyBtn = document.getElementById('forgot-verify-btn');
        var step = document.getElementById('forgot-step-text');
        if (codeEl) codeEl.classList.remove('hidden');
        if (verifyBtn) verifyBtn.classList.remove('hidden');
        if (step) step.innerText = 'เปิดหน้าส่งเมลแล้ว นำรหัส 6 หลักมากรอกที่นี่ (ใช้ได้ 10 นาที)';
        this.showToast('สร้างรหัสสำรองแล้ว ตรวจอีเมลที่ใช้สมัคร', 'success');
    }
    verifyResetCode() {
        var email = String((document.getElementById('forgot-email') || {}).value || '').trim().toLowerCase();
        var code = String((document.getElementById('forgot-code') || {}).value || '').trim();
        var resets = {};
        try { resets = JSON.parse(localStorage.getItem('tb_resets') || '{}'); } catch (e) {}
        var row = resets[email];
        if (!row || row.exp < Date.now()) return this.showToast('รหัสหมดอายุ ส่งใหม่อีกครั้ง', 'warning');
        if (row.code !== code) return this.showToast('รหัสสำรองไม่ถูกต้อง', 'error');
        this.resetEmail = email;
        ['forgot-new-pass', 'forgot-new-pass2'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        var saveBtn = document.getElementById('forgot-save-btn');
        var step = document.getElementById('forgot-step-text');
        if (saveBtn) saveBtn.classList.remove('hidden');
        if (step) step.innerText = 'รหัสถูกต้อง ตั้งรหัสผ่านใหม่ได้เลย';
    }
    saveNewPassword() {
        var p1 = (document.getElementById('forgot-new-pass') || {}).value || '';
        var p2 = (document.getElementById('forgot-new-pass2') || {}).value || '';
        if (!p1 || p1.length < 4) return this.showToast('รหัสใหม่ต้องมีอย่างน้อย 4 ตัว', 'warning');
        if (p1 !== p2) return this.showToast('รหัสยืนยันไม่ตรงกัน', 'error');
        var users = this.getUsers();
        var ok = false;
        for (var i = 0; i < users.length; i++) {
            if (users[i].email === this.resetEmail) { users[i].password = p1;
                ok = true; }
        }
        if (!ok || !this.saveUsers(users)) return this.showToast('บันทึกรหัสไม่สำเร็จ', 'error');
        var resets = {};
        try { resets = JSON.parse(localStorage.getItem('tb_resets') || '{}'); } catch (e) {}
        delete resets[this.resetEmail];
        localStorage.setItem('tb_resets', JSON.stringify(resets));
        var emailEl = document.getElementById('auth-email');
        var passEl = document.getElementById('auth-password');
        var box = document.getElementById('forgot-box');
        if (emailEl) emailEl.value = this.resetEmail;
        if (passEl) passEl.value = '';
        if (box) box.classList.add('hidden');
        this.authMode = 'login';
        this.showToast('ตั้งรหัสใหม่แล้ว เข้าสู่ระบบได้เลย', 'success');
    }
    handleLogout() {
        if (confirm('ออกจากระบบ?\nข้อมูลงานจะยังอยู่กับบัญชีนี้ เมื่อล็อกอินอีเมลเดิมจะกลับมาครบ')) {
            if (this.currentUser && this.currentUser.email) {
                localStorage.setItem('tb_last_email', this.normEmail(this.currentUser.email));
            }
            localStorage.removeItem('tb_current_user');
            sessionStorage.removeItem('tb_current_user');
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
        if (type === 'group') this.updateGroupSelectOptions();
        this.renderKanban();
    }
    getFriendRequests() {
        try { return JSON.parse(localStorage.getItem('tb_friend_requests') || '[]'); } catch (e) { return []; }
    }
    saveFriendRequests(list) { localStorage.setItem('tb_friend_requests', JSON.stringify(list)); }
    addFriendBoth(a, b) {
        a = this.normEmail(a);
        b = this.normEmail(b);
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
        if (e && e.preventDefault) e.preventDefault();
        if (!this.currentUser) return;
        const raw = document.getElementById('friend-email-input').value.trim();
        if (!raw) return this.showToast('กรอกอีเมลที่เพื่อนใช้สมัครแล้ว', 'warning');
        const matches = this.findUsers(raw);
        if (!matches.length) {
            var names = this.getUsers().map(function(u) { return u.email; }).join(', ');
            return this.showToast(names ? ('ไม่พบอีเมลนี้ในระบบ บัญชีที่มีอยู่: ' + names) : 'ไม่พบอีเมลนี้ เพื่อนต้องสมัครในเบราว์เซอร์นี้ก่อน', 'warning');
        }
        if (matches.length > 1) {
            return this.showToast('เจอหลายบัญชี: ' + matches.map(function(u) { return u.email; }).join(', ') + ' ใส่ให้ครบ', 'warning');
        }
        this.addLocalFriend(matches[0].email);
    }
    addLocalFriend(email) {
        if (!this.currentUser) return;
        email = this.normEmail(email);
        if (email === this.normEmail(this.currentUser.email)) return this.showToast('ไม่สามารถเพิ่มตัวเองได้', 'warning');
        if (this.getFriends().indexOf(email) !== -1) return this.showToast('เป็นเพื่อนกันอยู่แล้ว', 'warning');
        this.addFriendBoth(this.currentUser.email, email);
        var input = document.getElementById('friend-email-input');
        if (input) input.value = '';
        this.renderFriendsList();
        this.updateProfileBadge();
        this.showToast('เพิ่มเพื่อนแล้ว: ' + email, 'success');
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
        var me = this.normEmail(this.currentUser.email);
        email = this.normEmail(email);
        this.saveFriends(this.getFriends().filter(function(f) { return this.normEmail(f) !== email; }.bind(this)));
        var theirs = JSON.parse(localStorage.getItem('tb_friends_' + email) || '[]').filter(function(f) { return String(f).toLowerCase() !== me; });
        localStorage.setItem('tb_friends_' + email, JSON.stringify(theirs));
        this.renderFriendsList();
        this.showToast('ลบเพื่อนแล้ว', 'info');
    }
    renderFriendsList() {
        var list = document.getElementById('friends-list');
        if (list && this.currentUser) {
            var friends = this.getFriends();
            if (!friends.length) {
                list.innerHTML = '<div class="text-xs text-gray-600 py-3 text-center">ยังไม่มีเพื่อน</div>';
            } else {
                var html = '';
                for (var i = 0; i < friends.length; i++) {
                    var email = String(friends[i]);
                    html += '<div class="flex items-center justify-between p-2.5 bg-white/70 rounded-xl border border-[#c0b59f]/60">' +
                        '<span class="text-xs font-semibold text-[#1f3627]">' + this.escapeHtml(email) + '</span>' +
                        '<button type="button" onclick="app.removeFriend(\'' + this.escapeHtml(email) + '\')" class="text-xs text-red-600 font-bold px-2">ลบ</button>' +
                        '</div>';
                }
                list.innerHTML = html;
            }
        }
        this.renderLocalAccounts();
        this.renderFriendRequests();
        this.renderTeamInvitations();
        this.updateTaskFriendSelectOptions();
    }
    renderLocalAccounts() {
        var box = document.getElementById('local-accounts-list');
        if (!box) return;
        var me = this.currentUser ? this.normEmail(this.currentUser.email) : '';
        var others = this.getUsers().filter(function(u) { return this.normEmail(u.email) !== me; }.bind(this));
        if (!others.length) {
            box.innerHTML = 'ยังไม่มีบัญชีอื่นบนเครื่องนี้<br>ให้เพื่อนมากดสมัครในเบราว์เซอร์นี้ก่อน แล้วค่อยใส่อีเมลเพื่อน';
            return;
        }
        var html = '<div class="space-y-1">';
        others.forEach(function(u) {
            html += '<div class="flex items-center justify-between gap-2">' +
                '<span>' + this.escapeHtml(u.name || u.email) + ' <span class="text-gray-500">(' + this.escapeHtml(u.email) + ')</span></span>' +
                '<button type="button" onclick="app.addLocalFriend(\'' + this.escapeHtml(u.email) + '\')" class="px-2 py-1 bg-[#385441] text-white rounded-lg text-[10px] font-bold">เพิ่ม</button>' +
                '</div>';
        }.bind(this));
        html += '</div>';
        box.innerHTML = html;
    }
    renderFriendRequests() {
        var box = document.getElementById('friend-requests-list');
        if (!box || !this.currentUser) return;
        var me = this.normEmail(this.currentUser.email);
        var incoming = this.getFriendRequests().filter(function(r) { return this.normEmail(r.toEmail) === me && r.status === 'pending'; }.bind(this));
        var outgoing = this.getFriendRequests().filter(function(r) { return this.normEmail(r.fromEmail) === me && r.status === 'pending'; }.bind(this));
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
                '<div class="text-xs font-semibold">' + this.escapeHtml(inv.taskTitle) + '</div>' +
                '<div class="text-[10px] text-gray-600">จาก ' + this.escapeHtml(inv.senderEmail) + ' | บอร์ด ' + this.escapeHtml(inv.boardName || '') + '</div>' +
                '<div class="flex gap-2 justify-end">' +
                '<button onclick="app.respondInvitation(\'' + inv.id + '\', true)" class="px-3 py-1 bg-[#385441] text-white text-xs rounded-lg">ยอมรับ</button>' +
                '<button onclick="app.respondInvitation(\'' + inv.id + '\', false)" class="px-3 py-1 bg-gray-200 text-xs rounded-lg">ปฏิเสธ</button></div></div>';
        }.bind(this)).join('') : '<div class="text-xs text-gray-600 py-3 text-center">ไม่มีคำเชิญบอร์ด</div>';
    }
    updateTaskFriendSelectOptions() {
        var sel = document.getElementById('task-friend-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- เลือกเพื่อนจากรายชื่อ --</option>' +
            this.getFriends().map(function(e) { return '<option value="' + e + '">' + e + '</option>'; }).join('');
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
        var box = document.getElementById('profile-invitations-list');
        if (!box || !this.currentUser) return;
        const my = this.getInvitations().filter(function(i) { return i.targetEmail === this.currentUser.email && i.status === 'pending'; }.bind(this));
        box.innerHTML = my.length ? my.map(function(inv) {
            return '<div class="p-2.5 bg-white/70 rounded-xl border border-[#c0b59f]/60 space-y-1">' +
                '<div class="text-xs font-semibold">' + this.escapeHtml(inv.taskTitle) + '</div>' +
                '<div class="text-[10px] text-gray-600">จาก ' + this.escapeHtml(inv.senderEmail) + '</div></div>';
        }.bind(this)).join('') : '<div class="text-xs text-gray-600 py-3 text-center">ไม่มีคำเชิญ</div>';
    }
    updateProfileBadge() {
        if (!this.currentUser) return;
        const n = this.getInvitations().filter(function(i) { return i.targetEmail === this.currentUser.email && i.status === 'pending'; }.bind(this)).length;
        var fr = this.getFriendRequests().filter(function(r) { return r.toEmail === this.currentUser.email && r.status === 'pending'; }.bind(this)).length;
        var badge = document.getElementById('team-request-badge');
        var pBadge = document.getElementById('profile-invite-badge');
        var total = n + fr;
        if (badge) {
            badge.innerText = String(total);
            badge.classList.toggle('hidden', total === 0);
        }
        if (pBadge) pBadge.classList.toggle('hidden', n === 0);
    }
    respondInvitation(id, accept) {
        var inv = this.getInvitations();
        var i = inv.findIndex(function(x) { return x.id === id; });
        if (i === -1) return;
        inv[i].status = accept ? 'accepted' : 'rejected';
        this.saveInvitations(inv);
        this.renderFriendsList();
        this.updateProfileBadge();
        this.showToast(accept ? 'ยอมรับคำเชิญแล้ว' : 'ปฏิเสธคำเชิญแล้ว', 'info');
    }
    getVisibleTasks() {
        if (!this.currentUser) return [];
        const userEmail = this.currentUser.email;
        return this.getTasks().filter(function(t) {
            if (this.activeBoardType === 'personal') return t.type === 'personal';
            if (t.type !== 'group') return false;
            return !this.activeGroup || t.boardName === this.activeGroup;
        }.bind(this));
    }
    renderKanban() {
        this.updateGroupSelectOptions();
        var tasks = this.getVisibleTasks();
        ['todo', 'doing', 'done'].forEach(function(st) {
            var col = document.getElementById('col-' + st);
            var badge = document.getElementById('badge-' + st);
            if (!col) return;
            var list = tasks.filter(function(t) { return t.status === st; });
            col.innerHTML = '';
            list.forEach(function(task) { col.appendChild(this.createTaskCard(task)); }.bind(this));
            if (badge) badge.innerText = String(list.length);
        }.bind(this));
    }
    createTaskCard(task) {
        var self = this;
        var card = document.createElement('div');
        card.className = 'bg-white rounded-xl p-3 border border-[#c0b59f] shadow-sm space-y-1 cursor-pointer';
        card.innerHTML =
            '<div class="text-xs font-bold text-[#1f3627]">' + this.escapeHtml(task.title) + '</div>' +
            (task.type === 'group' && task.boardName ? '<div class="text-[9px] text-[#385441] bg-[#e0d8c7] inline-block px-1.5 py-0.5 rounded font-bold">' + this.escapeHtml(task.boardName) + '</div>' : '') +
            '<div class="text-[10px] text-gray-500">' + this.escapeHtml((task.startDate || '') + (task.dueDate ? ' → ' + task.dueDate : '')) + '</div>' +
            '<div class="task-detail hidden text-[10px] text-gray-600 pt-1">' + this.escapeHtml(task.scanText || task.getDisplayType && task.getDisplayType() || task.type) + '</div>' +
            '<button type="button" class="edit-task text-[10px] text-[#385441] font-bold">แก้ไข</button>';
        card.onclick = function() {
            var d = card.querySelector('.task-detail');
            if (d) d.classList.toggle('hidden');
        };
        card.querySelector('.edit-task').onclick = function(ev) {
            ev.stopPropagation();
            self.openEditTaskModal(task.id);
        };
        return card;
    }
    updateGroupSelectOptions() {
        const select = document.getElementById('group-select'),
            modal = document.getElementById('task-board-name');
        if (!select || !this.currentUser) return;
        const userEmail = this.currentUser.email;
        const groups = new Set(this.getGroupBoards());
        this.getTasks().forEach(function(t) {
            if (t.type === 'group' && t.boardName && (t.userEmail === userEmail || (t.taggedEmails || []).includes(userEmail))) groups.add(t.boardName);
        });
        if (!groups.has('งานกลุ่มทั่วไป')) groups.add('งานกลุ่มทั่วไป');
        const prevSelect = this.activeGroup || select.value || '';
        const prevModal = modal ? modal.value : '';
        select.innerHTML = '<option value="">-- บอร์ดกลุ่มทั้งหมด --</option>';
        if (modal) modal.innerHTML = '';
        Array.from(groups).sort().forEach(function(g) {
            select.appendChild(new Option(g, g));
            if (modal) modal.appendChild(new Option(g, g));
        });
        if (prevSelect) select.value = prevSelect;
        this.activeGroup = select.value;
        if (modal) {
            if (prevModal) modal.value = prevModal;
            else if (this.activeGroup) modal.value = this.activeGroup;
        }
    }
    handleGroupChange(v) {
        this.activeGroup = v;
        this.renderKanban();
    }
    addNewGroupBoard() {
        const name = prompt('ชื่อบอร์ดกลุ่มใหม่:');
        if (!name || !String(name).trim()) return;
        const boardName = this.ensureGroupBoard(String(name).trim());
        this.activeGroup = boardName;
        this.updateGroupSelectOptions();
        const sel = document.getElementById('group-select');
        if (sel) sel.value = boardName;
        this.activeGroup = boardName;
        this.renderKanban();
        this.showToast('สร้างบอร์ด "' + boardName + '" สำเร็จ', 'success');
    }
    deleteGroupBoard() {
        var sel = document.getElementById('group-select');
        var name = (sel && sel.value) || this.activeGroup || '';
        if (!name) return this.showToast('เลือกบอร์ดกลุ่มที่ต้องการลบก่อน', 'warning');
        if (name === 'งานกลุ่มทั่วไป') return this.showToast('ไม่สามารถลบบอร์ดเริ่มต้นได้', 'warning');
        if (!confirm('ลบบอร์ดกลุ่ม "' + name + '" ?\nงานในบอร์ดนี้จะถูกย้ายไป "งานกลุ่มทั่วไป"')) return;
        var boards = this.getGroupBoards().filter(function(b) { return b !== name; });
        this.saveGroupBoards(boards);
        var tasks = this.getTasks().map(function(t) {
            if (t.type === 'group' && t.boardName === name) t.boardName = 'งานกลุ่มทั่วไป';
            return t;
        });
        this.saveTasks(tasks);
        this.activeGroup = '';
        this.updateGroupSelectOptions();
        var sel2 = document.getElementById('group-select');
        if (sel2) sel2.value = '';
        this.renderKanban();
        this.showToast('ลบบอร์ดกลุ่ม "' + name + '" แล้ว', 'info');
    }
    openTaskModal() {
        ['task-id', 'task-title', 'task-start-date', 'task-due-date'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('task-priority').value = 'medium';
        document.getElementById('task-status').value = 'todo';
        document.getElementById('task-type').value = this.activeBoardType;
        document.getElementById('task-use-ai').checked = false;
        this.currentTaskMembers = [];
        this.renderTaskTaggedMembers();
        this.updateTaskFriendSelectOptions();
        this.updateGroupSelectOptions();
        this.toggleTaskTypeFields(this.activeBoardType);
        var ocrPrev = document.getElementById('ocr-result-preview');
        var delBtn = document.getElementById('btn-delete-task');
        if (ocrPrev) ocrPrev.classList.add('hidden');
        if (delBtn) delBtn.classList.add('hidden');
        document.getElementById('task-modal').classList.remove('hidden');
    }
    openEditTaskModal(id) {
        const task = this.getTasks().find(function(t) { return t.id === id; });
        if (!task) return;
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-start-date').value = task.startDate || '';
        document.getElementById('task-due-date').value = task.dueDate || '';
        document.getElementById('task-priority').value = task.priority || 'medium';
        document.getElementById('task-status').value = task.status || 'todo';
        document.getElementById('task-type').value = task.type || 'personal';
        document.getElementById('task-use-ai').checked = !!task.useAI;
        this.currentTaskMembers = task.taggedEmails || [];
        this.renderTaskTaggedMembers();
        this.updateTaskFriendSelectOptions();
        this.updateGroupSelectOptions();
        this.toggleTaskTypeFields(task.type || 'personal');
        if (task.type === 'group' && task.boardName) {
            const s = document.getElementById('task-board-name');
            if (s) s.value = task.boardName;
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
        this.currentTaskMembers.push(email);
        this.renderTaskTaggedMembers();
        document.getElementById('task-friend-select').value = '';
    }
    removeMemberFromCurrentTask(email) {
        this.currentTaskMembers = this.currentTaskMembers.filter(function(e) { return e !== email; });
        this.renderTaskTaggedMembers();
    }
    renderTaskTaggedMembers() {
        var box = document.getElementById('task-tagged-members-list');
        if (!box) return;
        box.innerHTML = this.currentTaskMembers.map(function(e) {
            return '<div class="flex justify-between text-xs"><span>' + this.escapeHtml(e) + '</span><button type="button" onclick="app.removeMemberFromCurrentTask(\'' + this.escapeHtml(e) + '\')">ลบ</button></div>';
        }.bind(this)).join('');
    }
    handleTaskSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!this.currentUser) return;
        const taskId = document.getElementById('task-id').value;
        const title = document.getElementById('task-title').value.trim();
        if (!title) return;
        var startDate = document.getElementById('task-start-date').value;
        var dueDate = document.getElementById('task-due-date').value;
        const priority = document.getElementById('task-priority').value;
        const status = document.getElementById('task-status').value;
        const type = document.getElementById('task-type').value;
        const useAI = document.getElementById('task-use-ai').checked;
        const userEmail = this.currentUser.email;
        let allTasks = this.getTasks();
        var boardEl = document.getElementById('task-board-name');
        const boardName = type === 'group' ? (boardEl ? boardEl.value : null) : null;
        var scanUrlEl = document.getElementById('task-scan-url');
        var oldTask = taskId ? allTasks.find(function(t) { return t.id === taskId; }) : null;
        var scanUrl = (scanUrlEl && scanUrlEl.value.trim()) || this.pendingScanUrl || (oldTask && oldTask.scanUrl) || '';
        var scanText = this.pendingScanText || (oldTask && oldTask.scanText) || '';
        var scanFile = this.pendingScanFile || (oldTask && oldTask.scanFile) || '';
        const data = { title, startDate, dueDate, time: '', location: '', priority, status, type, userEmail, boardName, taggedEmails: this.currentTaskMembers, useAI, scanUrl, scanText, scanFile };
        if (!startDate && !dueDate) {
            var now = new Date();
            dueDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            this.showToast('ไม่ได้ใส่วันที่ ระบบใส่เป็นวันนี้ให้แล้ว', 'warning');
        }
        data.startDate = startDate;
        data.dueDate = dueDate;
        let taskObj = type === 'group' ? new GroupTask(data) : new PersonalTask(data);
        taskObj.startDate = startDate || '';
        taskObj.dueDate = dueDate || '';
        taskObj.scanUrl = scanUrl;
        taskObj.scanText = scanText;
        taskObj.scanFile = scanFile;
        taskObj.dailyPlans = (useAI && startDate && dueDate) ? AIScheduler.createDailyPlans(taskObj) : [];
        if (useAI && startDate && dueDate) this.showToast('AI กำลังจัดสรรวัน...', 'info');
        if (taskId) {
            const idx = allTasks.findIndex(function(t) { return t.id === taskId; });
            if (idx !== -1) {
                taskObj.id = taskId;
                taskObj.createdAt = allTasks[idx].createdAt;
                taskObj.updatedAt = new Date().toISOString();
                allTasks[idx] = taskObj;
            }
        } else {
            allTasks.push(taskObj);
            if (type === 'group' && this.currentTaskMembers.length) {
                let inv = this.getInvitations();
                this.currentTaskMembers.forEach(function(target) {
                    if (target !== userEmail) inv.push({
                        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                        taskId: taskObj.id,
                        taskTitle: title,
                        boardName: boardName || 'งานกลุ่มทั่วไป',
                        senderEmail: userEmail,
                        targetEmail: target,
                        status: 'pending'
                    });
                });
                this.saveInvitations(inv);
            }
        }
        let pulled = false;
        if (status === 'done' && dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date(dueDate);
            due.setHours(0, 0, 0, 0);
            if (today < due) {
                const next = allTasks.filter(function(t) { return t.id !== taskObj.id && t.status !== 'done' && (t.startDate || t.dueDate); });
                if (next.length) {
                    const daysEarly = Math.round((due - today) / 86400000);
                    if (confirm('งานนี้เสร็จก่อนกำหนด ~' + daysEarly + ' วัน\n\nเลื่อนตารางงานถัดไปขึ้นไหม?\nตกลง = เลื่อนขึ้น | ยกเลิก = คงเดิม')) {
                        allTasks = this.pullUpNextTasks(taskObj, allTasks, daysEarly);
                        pulled = true;
                    }
                }
            }
        }
        this.pendingScanText = '';
        this.pendingScanUrl = '';
        this.pendingScanFile = '';
        this.saveTasks(allTasks);
        if (type === 'group' && boardName) this.ensureGroupBoard(boardName);
        this.updateGroupSelectOptions();
        this.closeTaskModal();
        this.renderKanban();
        this.renderCalendar();
        this.showToast(pulled ? 'เลื่อนตารางงานถัดไปแล้ว' : (taskId ? 'แก้ไขเรียบร้อย' : 'เพิ่มงานสำเร็จ'), 'success');
    }
    pullUpNextTasks(completed, allTasks, daysEarly) {
        if (!daysEarly || daysEarly <= 0) return allTasks;
        const shift = function(d) {
            if (!d) return d;
            const x = new Date(d);
            x.setDate(x.getDate() - daysEarly);
            return x.toISOString().slice(0, 10);
        };
        return allTasks.map(function(t) {
            if (t.id === completed.id || t.status === 'done' || !(t.startDate || t.dueDate)) return t;
            const u = Object.assign({}, t);
            if (u.startDate) u.startDate = shift(u.startDate);
            if (u.dueDate) u.dueDate = shift(u.dueDate);
            if (u.dailyPlans && u.dailyPlans.length) u.dailyPlans = u.dailyPlans.map(function(p) { return Object.assign({}, p, { date: shift(p.date) }); });
            return u;
        });
    }
    deleteTask(id) {
        if (!confirm('ลบงานนี้?')) return;
        const tid = id || document.getElementById('task-id').value;
        if (!tid) return;
        this.saveTasks(this.getTasks().filter(function(t) { return t.id !== tid; }));
        this.closeTaskModal();
        this.renderKanban();
        this.renderCalendar();
        this.showToast('ลบงานแล้ว', 'info');
    }
    handleImageOCRAndLocation(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (isPdf) return this.scanPdfFile(file);
        this.pendingScanFile = file.name;
        this.fillScanResult('งานสแกน: ' + file.name.replace(/\.[^.]+$/, ''), 'อ่านไฟล์สำเร็จ', file.name + ' (' + Math.ceil(file.size / 1024) + ' KB)');
        this.showToast('สแกนไฟล์สำเร็จ', 'success');
    }
    scanPdfFile(file) {
        var self = this;
        if (typeof pdfjsLib === 'undefined') return this.showToast('ยังไม่ได้โหลดตัวอ่าน PDF', 'error');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        this.showToast('กำลังดึงข้อความจาก PDF...', 'info');
        var reader = new FileReader();
        reader.onload = function() {
            pdfjsLib.getDocument({ data: reader.result }).promise.then(function(pdf) {
                var jobs = [];
                var maxPages = Math.min(pdf.numPages, 5);
                for (var i = 1; i <= maxPages; i++) {
                    jobs.push(pdf.getPage(i).then(function(page) {
                        return page.getTextContent().then(function(content) {
                            return content.items.map(function(item) { return item.str; }).join(' ');
                        });
                    }));
                }
                return Promise.all(jobs).then(function(pages) {
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
            }).catch(function() { self.showToast('อ่าน PDF ไม่สำเร็จ', 'error'); });
        };
        reader.readAsArrayBuffer(file);
    }
    ocrPdfPages(pdf, file) {
        var self = this;
        if (typeof Tesseract === 'undefined') return this.showToast('ยังไม่ได้โหลดตัว OCR', 'error');
        var maxPages = Math.min(pdf.numPages, 2);
        var chain = Promise.resolve('');
        for (var i = 1; i <= maxPages; i++) {
            (function(pageNo) {
                chain = chain.then(function(acc) {
                    return pdf.getPage(pageNo).then(function(page) {
                        var vp = page.getViewport({ scale: 1.3 });
                        var canvas = document.createElement('canvas');
                        canvas.width = vp.width;
                        canvas.height = vp.height;
                        return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise.then(function() {
                            return Tesseract.recognize(canvas, 'tha+eng').then(function(res) {
                                return acc + ' ' + ((res && res.data && res.data.text) || '');
                            });
                        });
                    });
                });
            })(i);
        }
        chain.then(function(text) {
            text = String(text || '').replace(/\s+/g, ' ').trim();
            var titleEl = document.getElementById('task-title');
            if (titleEl && !titleEl.value) titleEl.value = (text || file.name).slice(0, 80);
            self.fillScanResult(titleEl ? titleEl.value : file.name, 'OCR จาก PDF', text.slice(0, 400));
            self.showToast('OCR สำเร็จ', 'success');
        }).catch(function() { self.showToast('OCR ไม่สำเร็จ', 'error'); });
    }
    scanFromUrl() {
        var urlEl = document.getElementById('task-scan-url');
        var url = urlEl ? urlEl.value.trim() : '';
        if (!url) return this.showToast('วางลิงก์ก่อน', 'warning');
        this.pendingScanUrl = url;
        var titleEl = document.getElementById('task-title');
        if (titleEl && !titleEl.value) titleEl.value = url.replace(/^https?:\/\//, '').slice(0, 80);
        this.fillScanResult(titleEl ? titleEl.value : url, 'บันทึกลิงก์แล้ว', url);
        this.showToast('บันทึกลิงก์แล้ว', 'success');
    }
    fillScanResult(title, desc, extra) {
        this.pendingScanText = extra || desc || '';
        var prev = document.getElementById('ocr-result-preview');
        var d = document.getElementById('ocr-desc');
        var loc = document.getElementById('ocr-location-info');
        if (prev) prev.classList.remove('hidden');
        if (d) d.innerText = desc || '';
        if (loc) loc.innerText = extra || '';
        var titleEl = document.getElementById('task-title');
        if (titleEl && !titleEl.value && title) titleEl.value = title;
    }
    renderCalendar() {
        var grid = document.getElementById('calendar-days-grid');
        var title = document.getElementById('calendar-month-title');
        if (!grid || !title || !this.currentUser) return;
        var date = this.currentCalendarDate;
        var y = date.getFullYear(),
            m = date.getMonth();
        title.innerText = 'เดือน ' + (m + 1) + ' ปี ' + (y + 543);
        var first = new Date(y, m, 1);
        var startPad = first.getDay();
        var days = new Date(y, m + 1, 0).getDate();
        var tasks = this.getTasks();
        var html = '';
        for (var i = 0; i < startPad; i++) html += '<div></div>';
        var self = this;

        function clean(d) { return d ? String(d).slice(0, 10) : ''; }
        for (var day = 1; day <= days; day++) {
            var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var dayTasks = tasks.filter(function(t) {
                var a = clean(t.startDate),
                    b = clean(t.dueDate) || a;
                if (!a && !b) return false;
                if (!a) a = b;
                if (!b) b = a;
                return ds >= a && ds <= b;
            });
            html += '<div class="min-h-[72px] bg-white/70 rounded-xl p-1 border border-[#c0b59f]/50">' +
                '<div class="text-[10px] font-bold text-[#1f3627]">' + day + '</div>' +
                dayTasks.map(function(t) { return '<div class="text-[9px] truncate text-[#385441]">' + self.escapeHtml(t.title) + '</div>'; }).join('') +
                '</div>';
        }
        grid.innerHTML = html;
    }
    prevMonth() { this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
        this.renderCalendar(); }
    nextMonth() { this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
        this.renderCalendar(); }
    setTimerMode(mode) {
        this.stopTimer();
        this.timerMode = mode;
        this.timerTimeLeft = mode === 'elapsed' ? 0 : this.getTimerSeconds(mode);
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
        this.timerInterval = setInterval(function() {
            if (self.timerMode === 'elapsed') {
                self.timerTimeLeft++;
                self.updateTimerDisplay();
                return;
            }
            if (self.timerTimeLeft > 0) {
                self.timerTimeLeft--;
                self.updateTimerDisplay();
            } else {
                self.stopTimer();
                self.showToast('หมดเวลา!', 'warning');
            }
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
    showToast(msg, type) {
        type = type || 'info';
        const t = document.getElementById('toast');
        if (!t) return;
        const colors = { success: 'bg-[#385441] text-white', warning: 'bg-amber-600 text-white', info: 'bg-[#2d4735] text-white', error: 'bg-red-700 text-white' };
        t.className = 'fixed bottom-5 right-5 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium z-50 ' + (colors[type] || colors.info);
        t.innerText = msg;
        t.classList.remove('hidden');
        setTimeout(function() { t.classList.add('hidden'); }, 3000);
    }
}

let app;
window.addEventListener('DOMContentLoaded', function() {
    try { app = new App(); } catch (err) {
        console.error(err);
        alert('สคริปต์เริ่มไม่สำเร็จ: ' + err.message);
    }
});