(async function () {
  const API_BASE = ''; // Same origin
  const bank = window.QUESTION_BANK;
  if (!bank) {
    return;
  }

  // --- API Fetching ---
  async function fetchAdminData() {
    const token = localStorage.getItem('moonspell_admin_token');
    try {
      const response = await fetch(`${API_BASE}/api/admin/data`, {
        headers: { 'Authorization': token }
      });
      if (!response.ok) {
        if (response.status === 401) {
           // Token invalid or missing, let the UI handle it (reload to prompt)
           return null;
        }
        throw new Error('Failed to fetch data');
      }
      return await response.json();
    } catch (e) {
      console.warn('API fetch failed, falling back to local storage', e);
      return null;
    }
  }

  const apiData = await fetchAdminData();
  const IS_REMOTE = !!apiData;
  console.log('Admin Mode:', IS_REMOTE ? 'Remote API' : 'Local Storage');

  const GLOBAL_STORAGE_KEYS = {
    USERS: 'moonspell_users',
  };
  const USER_STORAGE_FIELDS = {
    MISTAKES: 'mistakes',
    HISTORY: 'history',
  };
  const STORAGE_KEY = 'moonspell-mistake-records';
  const TODAY = new Date().toISOString().slice(0, 10);

  const questionById = new Map(
    bank.questions.map(function (question) {
      return [question.globalId, question];
    })
  );

  function loadJson(key, fallback) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_error) {
      return fallback;
    }
  }

  // Helper to get history/mistakes from API data or LocalStorage
  function getUserData(userId, type) {
    if (!IS_REMOTE) {
       return loadJson(`moonspell_user:${userId}:${type}`, []);
    }

    // Remote Mode Logic
    if (type === USER_STORAGE_FIELDS.HISTORY) {
        return apiData.records
            .filter(r => r.userId === userId)
            .map(r => ({
                questionId: r.questionId,
                correct: r.correct,
                at: r.at,
                mode: r.mode
            }))
            .sort((a, b) => new Date(b.at) - new Date(a.at)); // Newest first
    }
    
    if (type === USER_STORAGE_FIELDS.MISTAKES) {
        // Approximation: Last attempt was wrong
        const history = apiData.records
            .filter(r => r.userId === userId)
            .sort((a, b) => new Date(a.at) - new Date(b.at)); // Oldest first
        
        const mistakes = new Set();
        history.forEach(h => {
            if (!h.correct) mistakes.add(h.questionId);
            else mistakes.delete(h.questionId); // Assume mastered if correct?
            // Actually, let's just keep it simple: any question with > 0 wrong count in recent history
            // But for now, let's use the "last attempt wrong" heuristic
        });
        return Array.from(mistakes);
    }
    return [];
  }

  function toIsoDate(value) {
    if (!value) {
      return TODAY;
    }
    return String(value).slice(0, 10);
  }

  function addDays(dateString, days) {
    const base = new Date(`${toIsoDate(dateString)}T00:00:00`);
    base.setDate(base.getDate() + days);
    return base.toISOString().slice(0, 10);
  }

  function computeQuestionStats(history) {
    const ordered = history.slice().sort(function (a, b) {
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    });
    const statsByQuestion = new Map();

    ordered.forEach(function (attempt) {
      const existing = statsByQuestion.get(attempt.questionId) || {
        attempts: [],
        wrongCount: 0,
        correctCount: 0,
        lastWrongOn: null,
        lastSeen: null,
        lastMode: 'LOCAL',
      };

      existing.attempts.push(attempt);
      existing.lastSeen = attempt.at;
      existing.lastMode = attempt.mode || existing.lastMode;

      if (attempt.correct) {
        existing.correctCount += 1;
      } else {
        existing.wrongCount += 1;
        existing.lastWrongOn = attempt.at;
      }

      statsByQuestion.set(attempt.questionId, existing);
    });

    statsByQuestion.forEach(function (stats, questionId) {
      let streak = 0;
      for (let index = stats.attempts.length - 1; index >= 0; index -= 1) {
        if (stats.attempts[index].correct) {
          streak += 1;
        } else {
          break;
        }
      }

      statsByQuestion.set(questionId, {
        attemptsCount: stats.attempts.length,
        wrongCount: stats.wrongCount,
        correctCount: stats.correctCount,
        lastWrongOn: stats.lastWrongOn ? toIsoDate(stats.lastWrongOn) : null,
        lastSeen: stats.lastSeen,
        lastMode: stats.lastMode,
        streak: streak,
      });
    });

    return statsByQuestion;
  }

  function buildNextReviewOn(stats, isActiveMistake) {
    const anchor = stats.lastWrongOn || toIsoDate(stats.lastSeen) || TODAY;
    if (!isActiveMistake) {
      return addDays(anchor, 14);
    }

    if (stats.wrongCount >= 4) {
      return anchor;
    }
    if (stats.wrongCount === 3) {
      return addDays(anchor, 1);
    }
    if (stats.wrongCount === 2) {
      return addDays(anchor, 2);
    }
    return addDays(anchor, 3);
  }

  function classifyStatus(stats, isActiveMistake, nextReviewOn) {
    if (!isActiveMistake) {
      return 'mastered';
    }
    if (nextReviewOn <= TODAY) {
      return 'due';
    }
    if (stats.wrongCount <= 1) {
      return 'new';
    }
    return 'review';
  }

  function buildTags(question, stats, isActiveMistake) {
    const tags = [];
    if (question && question.sectionCode) {
      tags.push(String(question.sectionCode).toLowerCase());
    }

    const blankCount = (String(question && question.stem ? question.stem : '').match(/_{4,}/g) || []).length;
    if (blankCount > 1) {
      tags.push('double blank');
    }

    if (stats.lastMode === 'ERROR') {
      tags.push('error review');
    }

    if (isActiveMistake) {
      tags.push('active');
    }

    return tags.length ? tags : ['practice'];
  }

  function buildSourceDb() {
    const users = IS_REMOTE ? apiData.users : loadJson(GLOBAL_STORAGE_KEYS.USERS, []);
    const students = [];
    const records = [];

    users.forEach(function (user) {
      const history = getUserData(user.id, USER_STORAGE_FIELDS.HISTORY);
      const activeMistakes = new Set(getUserData(user.id, USER_STORAGE_FIELDS.MISTAKES));
      const statsByQuestion = computeQuestionStats(history);
      const questionIds = new Set(activeMistakes);

      statsByQuestion.forEach(function (stats, questionId) {
        if (stats.wrongCount > 0) {
          questionIds.add(questionId);
        }
      });

      const correctCount = history.filter(function (attempt) {
        return !!attempt.correct;
      }).length;

      students.push({
        id: user.id,
        name: user.username || user.name || user.email || user.id,
        className: user.className || 'Independent',
        grade: user.grade || 'SAT SC',
        email: user.email || '',
        lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '',
        totalAnswered: history.length,
        correctCount: correctCount,
        accuracy: history.length ? Math.round((correctCount / history.length) * 100) : 0,
        activeMistakeCount: activeMistakes.size,
      });

      questionIds.forEach(function (questionId) {
        const stats = statsByQuestion.get(questionId) || {
          attemptsCount: 0,
          wrongCount: 0,
          correctCount: 0,
          lastWrongOn: null,
          lastSeen: null,
          lastMode: 'LOCAL',
          streak: 0,
        };
        const question = questionById.get(questionId);
        const isActiveMistake = activeMistakes.has(questionId);

        if (!isActiveMistake && stats.wrongCount === 0) {
          return;
        }

        const nextReviewOn = buildNextReviewOn(stats, isActiveMistake);
        records.push({
          id: `${user.id}::${questionId}`,
          studentId: user.id,
          questionId: questionId,
          wrongCount: stats.wrongCount,
          streak: stats.streak,
          status: classifyStatus(stats, isActiveMistake, nextReviewOn),
          lastWrongOn: stats.lastWrongOn || TODAY,
          nextReviewOn: nextReviewOn,
          note: '',
          tags: buildTags(question, stats, isActiveMistake),
        });
      });
    });

    students.sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    records.sort(function (a, b) {
      if (a.nextReviewOn !== b.nextReviewOn) {
        return String(a.nextReviewOn).localeCompare(String(b.nextReviewOn));
      }
      if (b.wrongCount !== a.wrongCount) {
        return b.wrongCount - a.wrongCount;
      }
      return String(a.questionId).localeCompare(String(b.questionId));
    });

    return { students: students, records: records };
  }

  function loadPersistedRecords() {
    return loadJson(STORAGE_KEY, {});
  }

  function persistRecord(record) {
    const persisted = loadPersistedRecords();
    persisted[record.id] = {
      status: record.status,
      note: record.note,
      nextReviewOn: record.nextReviewOn,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }

  const sourceDb = buildSourceDb();
  const studentById = new Map(
    sourceDb.students.map(function (student) {
      return [student.id, student];
    })
  );
  const persistedRecords = loadPersistedRecords();
  const records = sourceDb.records.map(function (record) {
    const persisted = persistedRecords[record.id] || {};
    return { ...record, ...persisted };
  });

  const state = {
    selectedClass: 'all',
    selectedStudentId: 'all',
    selectedStatus: 'all',
    search: '',
    activeRecordId: records[0] ? records[0].id : null,
  };

  const dashboardStats = document.getElementById('dashboardStats');
  const classSelect = document.getElementById('classSelect');
  const studentList = document.getElementById('studentList');
  const recordHeading = document.getElementById('recordHeading');
  const recordSearch = document.getElementById('recordSearch');
  const statusFilters = document.getElementById('statusFilters');
  const recordTable = document.getElementById('recordTable');
  const detailCard = document.getElementById('detailCard');
  const studentSummary = document.getElementById('studentSummary');

  function createStatCard(value, label) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    return card;
  }

  function todayCount() {
    return records.filter(function (record) {
      return record.nextReviewOn <= TODAY && record.status !== 'mastered';
    }).length;
  }

  function repeatMissCount() {
    return records.filter(function (record) {
      return record.wrongCount >= 3;
    }).length;
  }

  function renderStats() {
    dashboardStats.replaceChildren(
      createStatCard(sourceDb.students.length, 'Students'),
      createStatCard(records.length, 'Mistake Records'),
      createStatCard(todayCount(), 'Due Now'),
      createStatCard(repeatMissCount(), 'Repeat Misses')
    );
  }

  function renderClassSelect() {
    const classes = ['all'].concat(
      Array.from(
        new Set(
          sourceDb.students.map(function (student) {
            return student.className;
          })
        )
      ).filter(Boolean).sort()
    );

    classSelect.innerHTML = classes
      .map(function (className) {
        const label = className === 'all' ? 'All classes' : className;
        return `<option value="${className}">${label}</option>`;
      })
      .join('');
  }

  function studentCounts() {
    const counts = {};
    records.forEach(function (record) {
      counts[record.studentId] = (counts[record.studentId] || 0) + 1;
    });
    return counts;
  }

  function filteredStudents() {
    return sourceDb.students.filter(function (student) {
      return state.selectedClass === 'all' || student.className === state.selectedClass;
    });
  }

  function renderStudentList() {
    const counts = studentCounts();
    const fragment = document.createDocumentFragment();

    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'student-item' + (state.selectedStudentId === 'all' ? ' is-active' : '');
    allButton.innerHTML = `<strong>All students</strong><div class="muted">${records.length} records</div>`;
    allButton.addEventListener('click', function () {
      state.selectedStudentId = 'all';
      renderStudentList();
      renderRecordTable();
    });
    fragment.appendChild(allButton);

    filteredStudents().forEach(function (student) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'student-item' + (state.selectedStudentId === student.id ? ' is-active' : '');
      button.innerHTML = `<strong>${student.name}</strong><div class="muted">${student.className} · ${student.grade} · ${counts[student.id] || 0} records</div>`;
      button.addEventListener('click', function () {
        state.selectedStudentId = student.id;
        renderStudentList();
        renderRecordTable();
      });
      fragment.appendChild(button);
    });

    if (!sourceDb.students.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No real student accounts yet. Log in from the student app and complete a few questions first.';
      fragment.appendChild(empty);
    }

    studentList.replaceChildren(fragment);
  }

  function renderStatusFilters() {
    const filters = [
      ['all', 'All'],
      ['new', 'New'],
      ['review', 'Review'],
      ['due', 'Due'],
      ['mastered', 'Mastered'],
    ];
    const fragment = document.createDocumentFragment();
    filters.forEach(function (pair) {
      const value = pair[0];
      const label = pair[1];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'status-pill' + (state.selectedStatus === value ? ' is-active' : '');
      button.textContent = label;
      button.addEventListener('click', function () {
        state.selectedStatus = value;
        renderStatusFilters();
        renderRecordTable();
      });
      fragment.appendChild(button);
    });
    statusFilters.replaceChildren(fragment);
  }

  function searchableRecordText(record) {
    const student = studentById.get(record.studentId);
    const question = questionById.get(record.questionId);
    return [
      record.id,
      record.questionId,
      record.status,
      record.note,
      student ? student.name : '',
      student ? student.className : '',
      question ? question.localId : '',
      question ? question.sectionDisplayName : '',
      question ? question.stem : '',
    ]
      .join(' ')
      .toLowerCase();
  }

  function filteredRecords() {
    const needle = state.search.trim().toLowerCase();
    return records.filter(function (record) {
      const student = studentById.get(record.studentId);
      if (state.selectedClass !== 'all' && student && student.className !== state.selectedClass) {
        return false;
      }
      if (state.selectedStudentId !== 'all' && record.studentId !== state.selectedStudentId) {
        return false;
      }
      if (state.selectedStatus !== 'all' && record.status !== state.selectedStatus) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return searchableRecordText(record).includes(needle);
    });
  }

  function renderStudentSummary() {
    if (state.selectedStudentId === 'all') {
      studentSummary.style.display = 'none';
      return;
    }

    const student = studentById.get(state.selectedStudentId);
    if (!student) {
      studentSummary.style.display = 'none';
      return;
    }

    const studentRecords = records.filter(function (record) {
      return record.studentId === student.id;
    });
    const activeMistakes = studentRecords.filter(function (record) {
      return record.status !== 'mastered';
    }).length;
    const masteryRate = `${student.accuracy || 0}%`;

    studentSummary.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 1.5rem; flex-wrap: wrap;">
        <div>
          <h3 style="margin: 0; font-size: 1.25rem;">${student.name}</h3>
          <div class="muted" style="margin-top: 0.25rem;">${student.className} · ${student.grade}</div>
          <div class="muted" style="margin-top: 0.25rem;">${student.email || 'No email'}</div>
          <div class="muted" style="margin-top: 0.25rem;">Last Login: ${student.lastLogin || 'Never'}</div>
        </div>
        <div style="text-align: right; display: flex; gap: 2rem; flex-wrap: wrap;">
          <div>
            <div class="muted" style="font-size: 0.875rem;">Accuracy</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${masteryRate}</div>
          </div>
          <div>
            <div class="muted" style="font-size: 0.875rem;">Total Answered</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${student.totalAnswered || 0}</div>
          </div>
          <div>
            <div class="muted" style="font-size: 0.875rem;">Active Issues</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--red);">${activeMistakes}</div>
          </div>
        </div>
      </div>
    `;
    studentSummary.style.display = 'block';
  }

  function renderRecordTable() {
    renderStudentSummary();
    const visibleRecords = filteredRecords();
    const subjectLabel =
      state.selectedStudentId === 'all'
        ? 'all visible students'
        : (studentById.get(state.selectedStudentId) || {}).name || 'student';

    recordHeading.textContent = `${visibleRecords.length} records for ${subjectLabel}`;

    if (!sourceDb.students.length) {
      recordTable.innerHTML = '<div class="empty-state">No real student data yet. Create a student account in the main app and answer a few questions first.</div>';
      detailCard.innerHTML = '<div class="detail-card is-empty">This board is now wired to real local student accounts only. Demo users have been removed.</div>';
      return;
    }

    if (!visibleRecords.length) {
      recordTable.innerHTML = '<div class="empty-state">No mistake records matched the current filters.</div>';
      detailCard.innerHTML = '<div class="detail-card is-empty">Select another student or loosen the filters.</div>';
      return;
    }

    if (
      !visibleRecords.some(function (record) {
        return record.id === state.activeRecordId;
      })
    ) {
      state.activeRecordId = visibleRecords[0].id;
    }

    const tableFragment = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'record-row record-row__header';
    header.innerHTML = `
      <div>Student</div>
      <div>Question</div>
      <div>Section</div>
      <div>Wrong</div>
      <div>Next Review</div>
      <div>Status</div>
    `;
    tableFragment.appendChild(header);

    visibleRecords.forEach(function (record) {
      const student = studentById.get(record.studentId);
      const question = questionById.get(record.questionId);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'record-row' + (record.id === state.activeRecordId ? ' is-active' : '');
      row.innerHTML = `
        <div><strong>${student ? student.name : record.studentId}</strong><div class="muted">${student ? student.className : ''}</div></div>
        <div><strong>${record.questionId}</strong><div class="muted">${question ? question.localId : ''}</div></div>
        <div>${question ? question.sectionCode : '-'}</div>
        <div>${record.wrongCount}x</div>
        <div>${record.nextReviewOn}</div>
        <div><span class="status status--${record.status}">${record.status}</span></div>
      `;
      row.addEventListener('click', function () {
        state.activeRecordId = record.id;
        renderRecordTable();
      });
      tableFragment.appendChild(row);
    });

    recordTable.replaceChildren(tableFragment);
    renderDetail();
  }

  function renderDetail() {
    const record = records.find(function (item) {
      return item.id === state.activeRecordId;
    });

    if (!record) {
      detailCard.innerHTML = '<div class="detail-card is-empty">Select a record to inspect it.</div>';
      return;
    }

    const student = studentById.get(record.studentId);
    const question = questionById.get(record.questionId);
    if (!question) {
      detailCard.innerHTML = '<div class="detail-card is-empty">The linked question was not found in the current bank.</div>';
      return;
    }

    detailCard.innerHTML = `
      <div class="detail-card__head">
        <div class="badge-row">
          <span class="badge">${record.questionId}</span>
          <span class="badge">${question.localId}</span>
          <span class="badge">${student ? student.name : record.studentId}</span>
        </div>
        <h3>${question.sectionDisplayName}</h3>
      </div>

      <div class="detail-card__grid">
        <div class="detail-row">
          <strong>Question</strong>
          <div>${question.stem}</div>
        </div>

        <div class="detail-row">
          <strong>Options</strong>
          <ol class="detail-options">
            ${question.options
              .map(function (option) {
                return `<li><span class="option-label">${option.label}</span><span>${option.text}</span></li>`;
              })
              .join('')}
          </ol>
        </div>

        <div class="detail-row">
          <strong>Teaching Notes</strong>
          <div class="detail-meta">Wrong count ${record.wrongCount} · current streak ${record.streak} · tags ${record.tags.join(', ')}</div>
        </div>

        <label class="field">
          <span>Status</span>
          <select id="detailStatus">
            ${['new', 'review', 'due', 'mastered']
              .map(function (status) {
                return `<option value="${status}" ${status === record.status ? 'selected' : ''}>${status}</option>`;
              })
              .join('')}
          </select>
        </label>

        <label class="field">
          <span>Next Review</span>
          <input id="detailReviewDate" type="date" value="${record.nextReviewOn}" />
        </label>

        <label class="field">
          <span>Teacher Note</span>
          <textarea id="detailNote">${record.note}</textarea>
        </label>

        <div class="detail-actions">
          <button id="saveRecord" class="button button--solid" type="button">Save record</button>
        </div>
      </div>
    `;

    document.getElementById('saveRecord').addEventListener('click', function () {
      record.status = document.getElementById('detailStatus').value;
      record.nextReviewOn = document.getElementById('detailReviewDate').value;
      record.note = document.getElementById('detailNote').value.trim();
      persistRecord(record);
      renderStats();
      renderStatusFilters();
      renderRecordTable();
    });
  }

  classSelect.addEventListener('change', function (event) {
    state.selectedClass = event.target.value;
    if (state.selectedStudentId !== 'all') {
      const selectedStudent = studentById.get(state.selectedStudentId);
      if (
        !selectedStudent ||
        (state.selectedClass !== 'all' && selectedStudent.className !== state.selectedClass)
      ) {
        state.selectedStudentId = 'all';
      }
    }
    renderStudentList();
    renderRecordTable();
  });

  recordSearch.addEventListener('input', function (event) {
    state.search = event.target.value;
    renderRecordTable();
  });

  renderStats();
  renderClassSelect();
  renderStudentList();
  renderStatusFilters();
  renderRecordTable();
})();
