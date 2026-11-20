(function () {
  'use strict';

  if (!window.Vue || !window.ELEMENT) {
    document.getElementById('bootError').hidden = false;
    return;
  }

  var STORAGE_KEY = 'today-page.element.v1';
  var VIEWS = [
    { id: 'today', label: '今天' },
    { id: 'week', label: '本周' },
    { id: 'all', label: '全部' },
    { id: 'done', label: '已完成' }
  ];

  function pad(n) { return String(n).padStart(2, '0'); }
  function startOfDay(date) { var d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
  function addDays(date, n) { var d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function dateKeyOf(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function dateFromKey(key) {
    if (!key) return null;
    var parts = key.split('-').map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }
  function startOfWeek(date) {
    var d = startOfDay(date);
    var offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
    return addDays(d, offset);
  }
  function buildTimeOptions() {
    var options = [];
    for (var hour = 0; hour < 24; hour++) {
      for (var minute = 0; minute < 60; minute += 30) {
        options.push(pad(hour) + ':' + pad(minute));
      }
    }
    return options;
  }

  new Vue({
    el: '#app',
    data: function () {
      return {
        views: VIEWS,
        dayLabels: ['一', '二', '三', '四', '五', '六', '日'],
        view: 'today',
        search: '',
        tasks: this.loadTasks(),
        categories: ['工作', '生活', '学习', '健康'],
        timeOptions: buildTimeOptions(),
        draft: { title: '', date: dateKeyOf(new Date()), category: '工作' },
        menuOpen: false,
        dialogVisible: false,
        editor: { id: '', title: '', notes: '', date: '', time: '', category: '工作', priority: 'medium' }
      };
    },
    computed: {
      todayKey: function () { return dateKeyOf(new Date()); },
      todayMark: function () {
        var d = new Date();
        return pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' 周' + this.dayLabels[(d.getDay() + 6) % 7];
      },
      completedTasks: function () { return this.tasks.filter(function (task) { return task.completed; }); },
      todayTasks: function () { return this.tasks.filter(this.isTodayAgenda, this); },
      remainingToday: function () { return this.todayTasks.filter(function (task) { return !task.completed; }).length; },
      todayCount: function () { return this.remainingToday; },
      todayCompleted: function () { return this.todayTasks.filter(function (task) { return task.completed; }).length; },
      baseViewTasks: function () {
        var tasks = this.tasks.slice();
        if (this.view === 'today') return tasks.filter(this.isTodayAgenda, this);
        if (this.view === 'week') return tasks.filter(function (task) { return this.inCurrentWeek(task) || (!task.completed && this.isOverdue(task)); }, this);
        if (this.view === 'done') return tasks.filter(function (task) { return task.completed; });
        return tasks;
      },
      progressTasks: function () { return this.baseViewTasks.filter(this.matchesSearch, this); },
      visibleTasks: function () {
        var tasks = this.baseViewTasks.filter(this.matchesSearch, this);
        if (this.view === 'today') tasks = tasks.filter(function (task) { return !task.completed; });
        return this.sortTasks(tasks);
      },
      progressDone: function () { return this.progressTasks.filter(function (task) { return task.completed; }).length; },
      progressTotal: function () { return this.progressTasks.length; },
      progressPercent: function () { return this.progressTotal ? Math.round(this.progressDone / this.progressTotal * 100) : 0; },
      resultLabel: function () {
        var noun = this.view === 'done' ? '条完成记录' : '件待办';
        return (this.search.trim() ? '找到 ' : '') + this.visibleTasks.length + ' ' + noun;
      },
      hasCompleted: function () { return this.completedTasks.length > 0; },
      viewTitle: function () {
        return { today: '今日待办', week: '本周待办', all: '全部待办', done: '已完成' }[this.view];
      },
      viewSub: function () {
        var now = new Date();
        var todayLabel = (now.getMonth() + 1) + '月' + now.getDate() + '日，周' + this.dayLabels[(now.getDay() + 6) % 7];
        if (this.view === 'week') {
          var weekOpen = this.tasks.filter(function (task) { return this.inCurrentWeek(task) && !task.completed; }, this).length;
          return this.weekRange + ' · 本周还剩 ' + weekOpen + ' 件，今天占 ' + this.remainingToday + ' 件。';
        }
        if (this.view === 'all') {
          var open = this.tasks.filter(function (task) { return !task.completed; }).length;
          var dueToday = this.tasks.filter(function (task) { return this.dueKey(task) === this.todayKey; }, this).length;
          return '共 ' + this.tasks.length + ' 件记录，' + open + ' 件未完成，其中 ' + dueToday + ' 件今天到期。';
        }
        if (this.view === 'done') {
          var latest = this.completedTasks.slice().sort(function (a, b) { return new Date(b.completedAt || 0) - new Date(a.completedAt || 0); })[0];
          return '共 ' + this.completedTasks.length + ' 件已完成' + (latest ? '，最近完成于' + this.completedLabel(latest) : '。');
        }
        var overdue = this.tasks.filter(this.isOverdue, this).sort(function (a, b) { return new Date(a.due) - new Date(b.due); });
        var next = this.todayTasks.filter(function (task) { return !task.completed; }).sort(function (a, b) { return new Date(a.due) - new Date(b.due); })[0];
        var finding = overdue.length
          ? '还剩 ' + this.remainingToday + ' 件，先处理已逾期的「' + overdue[0].title + '」。'
          : (next ? '还剩 ' + this.remainingToday + ' 件，先完成「' + next.title + '」。' : '今天的清单已经收尾，可以开始安排明天。');
        return todayLabel + ' · ' + finding;
      },
      ledgerTitle: function () {
        return { today: '今天的清单', week: '本周清单', all: '全部清单', done: '完成记录' }[this.view];
      },
      ledgerMeta: function () {
        return this.view === 'done' ? '按完成时间倒序排列' : (this.view === 'all' ? '未完成优先，再按时间排列' : '按时间和优先级排列');
      },
      emptyTitle: function () {
        if (this.search.trim()) return '没有找到匹配的待办';
        return this.view === 'done' ? '还没有完成记录' : '这张清单现在是空的';
      },
      emptyText: function () {
        return this.search.trim() ? '换一个关键词，或清空搜索。' : '从上方记下一件今天要完成的事。';
      },
      emptyActionText: function () { return this.search.trim() ? '清空搜索' : '记下一件事'; },
      weekRange: function () {
        var start = startOfWeek(new Date());
        var end = addDays(start, 6);
        return (start.getMonth() + 1) + '月' + start.getDate() + '日—' + (end.getMonth() + 1) + '月' + end.getDate() + '日';
      },
      weekDays: function () {
        var start = startOfWeek(new Date());
        var days = [];
        var max = 1;
        for (var i = 0; i < 7; i++) {
          var date = addDays(start, i);
          var key = dateKeyOf(date);
          var count = this.tasks.filter(function (task) { return task.completed && this.dueKey(task) === key; }, this).length;
          if (count > max) max = count;
          days.push({ date: date, key: key, count: count, today: key === this.todayKey, x: 8 + (264 / 7) * i + (264 / 14) });
        }
        return days.map(function (day) {
          day.height = day.count === 0 ? 0 : Math.max(5, day.count / max * 76);
          return day;
        });
      },
      weekSummary: function () {
        var count = this.weekDays.filter(function (day) { return day.count > 0; }).length;
        return count + ' 天有记录';
      },
      weekNote: function () {
        return '今天完成 ' + this.todayCompleted + ' 件，还剩 ' + this.remainingToday + ' 件。';
      },
      weekGrid: function () { return [{ y: 74 }, { y: 36 }]; },
      upcoming: function () {
        return this.tasks.filter(function (task) { return !task.completed && this.dueKey(task) > this.todayKey; }, this)
          .sort(function (a, b) { return new Date(a.due) - new Date(b.due); }).slice(0, 4);
      }
    },
    mounted: function () {
      var hash = (location.hash || '').replace(/^#/, '');
      if (VIEWS.some(function (item) { return item.id === hash; })) this.view = hash;
      else history.replaceState(null, '', '#today');
    },
    methods: {
      loadTasks: function () {
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            var parsed = JSON.parse(stored);
            if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
          }
        } catch (e) { /* fall back to examples */ }
        var seed = window.TodoSeed && window.TodoSeed.create ? window.TodoSeed.create() : { tasks: [] };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seed)); } catch (e) { /* storage may be blocked */ }
        return seed.tasks;
      },
      saveTasks: function () {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: this.tasks })); }
        catch (e) { this.notify('无法保存到浏览器，请检查本地存储权限。'); }
      },
      notify: function (message) {
        this.$message({ message: message, customClass: 'element-demo-message', duration: 1200, showClose: false });
      },
      setView: function (view) {
        if (!VIEWS.some(function (item) { return item.id === view; })) return;
        this.view = view;
        this.search = '';
        this.menuOpen = false;
        history.replaceState(null, '', '#' + view);
      },
      dueKey: function (task) { return task.due ? task.due.slice(0, 10) : ''; },
      dueTime: function (task) { return task.due ? task.due.slice(11, 16) : ''; },
      isOverdue: function (task) { return !task.completed && !!task.due && this.dueKey(task) < this.todayKey; },
      isTodayAgenda: function (task) { return this.dueKey(task) === this.todayKey || this.isOverdue(task); },
      inCurrentWeek: function (task) {
        var key = this.dueKey(task);
        if (!key) return false;
        return key >= dateKeyOf(startOfWeek(new Date())) && key <= dateKeyOf(addDays(startOfWeek(new Date()), 6));
      },
      matchesSearch: function (task) {
        var needle = this.search.trim().toLocaleLowerCase('zh-CN');
        if (!needle) return true;
        return [task.title, task.notes, task.category].join(' ').toLocaleLowerCase('zh-CN').indexOf(needle) !== -1;
      },
      sortTasks: function (tasks) {
        return tasks.sort(function (a, b) {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (a.completed && b.completed) return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
          var overdueA = this.isOverdue(a) ? 0 : 1;
          var overdueB = this.isOverdue(b) ? 0 : 1;
          if (overdueA !== overdueB) return overdueA - overdueB;
          return (a.due ? new Date(a.due).getTime() : Infinity) - (b.due ? new Date(b.due).getTime() : Infinity);
        }.bind(this));
      },
      relativeDateLabel: function (key) {
        var d = dateFromKey(key);
        if (!d) return '未排期';
        var diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
        if (diff === 0) return '今天';
        if (diff === 1) return '明天';
        if (diff === -1) return '昨天';
        if (diff > 1 && diff < 7) return '周' + this.dayLabels[(d.getDay() + 6) % 7];
        return (d.getMonth() + 1) + '/' + d.getDate();
      },
      formatMonthDay: function (date) { return (date.getMonth() + 1) + '月' + date.getDate() + '日'; },
      completedLabel: function (task) {
        if (!task.completedAt) return '已完成';
        var d = new Date(task.completedAt);
        var diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
        var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
        if (diff === 0) return '今天 ' + time + ' 完成';
        if (diff === -1) return '昨天 ' + time + ' 完成';
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + time + ' 完成';
      },
      taskTimeParts: function (task) {
        var key = this.dueKey(task);
        var time = this.dueTime(task) || '随时';
        if (this.view === 'today') return { main: time, sub: this.relativeDateLabel(key) };
        if (this.view === 'week') {
          var d = dateFromKey(key);
          return { main: d ? '周' + this.dayLabels[(d.getDay() + 6) % 7] : '未排期', sub: time };
        }
        var d2 = dateFromKey(key);
        return { main: d2 ? (d2.getMonth() + 1) + '/' + d2.getDate() : '未排期', sub: time };
      },
      addTask: function () {
        var title = this.draft.title.trim();
        if (!title) { this.$refs.quickInput.focus(); return; }
        this.tasks.push({
          id: 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
          title: title,
          notes: '',
          category: this.draft.category || '工作',
          priority: 'medium',
          due: (this.draft.date || this.todayKey) + 'T23:59:00',
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString()
        });
        this.draft.title = '';
        this.search = '';
        this.saveTasks();
        this.notify('已添加：' + title);
        if (this.view === 'done') this.setView('today');
        this.$nextTick(function () { this.$refs.quickInput.focus(); }.bind(this));
      },
      toggleTask: function (task) {
        task.completedAt = task.completed ? new Date().toISOString() : null;
        this.saveTasks();
        this.notify((task.completed ? '已完成：' : '已恢复：') + task.title);
      },
      openEditor: function (task) {
        this.editor = {
          id: task.id,
          title: task.title,
          notes: task.notes || '',
          date: this.dueKey(task),
          time: this.dueTime(task) || '23:59',
          category: task.category || '工作',
          priority: task.priority || 'medium'
        };
        this.dialogVisible = true;
        this.$nextTick(function () { if (this.$refs.editorTitle) this.$refs.editorTitle.focus(); }.bind(this));
      },
      resetEditor: function () {
        this.editor = { id: '', title: '', notes: '', date: '', time: '', category: '工作', priority: 'medium' };
      },
      saveEditor: function () {
        var task = this.tasks.filter(function (item) { return item.id === this.editor.id; }, this)[0];
        if (!task) return;
        if (!this.editor.title.trim()) { this.notify('先写下待办内容。'); return; }
        var time = this.editor.time ? this.editor.time.trim() : '';
        var timeMatch = time.match(/^(\d{1,2}):([0-5]\d)$/);
        if (time && (!timeMatch || Number(timeMatch[1]) > 23)) {
          this.notify('时间请用 24 小时格式，例如 14:30。');
          return;
        }
        time = timeMatch ? pad(Number(timeMatch[1])) + ':' + timeMatch[2] : '';
        task.title = this.editor.title.trim();
        task.notes = this.editor.notes.trim();
        task.category = this.editor.category;
        task.priority = this.editor.priority;
        task.due = this.editor.date ? this.editor.date + 'T' + (time || '23:59') + ':00' : null;
        this.saveTasks();
        this.dialogVisible = false;
        this.notify('已保存：' + task.title);
      },
      deleteTask: function () {
        var task = this.tasks.filter(function (item) { return item.id === this.editor.id; }, this)[0];
        if (!task) return;
        var title = task.title;
        this.$confirm('删除「' + title + '」后无法恢复。', '删除待办', {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
          customClass: 'danger-confirm'
        }).then(function () {
          this.tasks = this.tasks.filter(function (item) { return item.id !== task.id; });
          this.saveTasks();
          this.dialogVisible = false;
          this.notify('已删除：' + title);
        }.bind(this)).catch(function () {});
      },
      clearCompleted: function () {
        var count = this.completedTasks.length;
        if (!count) return;
        this.$confirm('将删除 ' + count + ' 条已完成记录，此操作无法恢复。', '清除已完成', {
          confirmButtonText: '清除',
          cancelButtonText: '取消',
          type: 'warning',
          customClass: 'danger-confirm'
        }).then(function () {
          this.tasks = this.tasks.filter(function (task) { return !task.completed; });
          this.saveTasks();
          this.notify('已清除 ' + count + ' 条完成记录');
        }.bind(this)).catch(function () {});
      },
      emptyAction: function () {
        if (this.search.trim()) { this.search = ''; return; }
        this.$refs.quickInput.focus();
      }
    }
  });
})();
