document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    currentView: 'main-view',

    init: function () {
        this.bindNavigation();
        this.bindItemsManagement();
        this.bindTimerActions();
        this.bindHistoryActions();
        this.bindSettingsActions();
        this.bindTutorialActions();

        // Initialize Timer
        TimerAPI.init(
            (formattedTime, diffMs, startObj) => this.onTimerTick(formattedTime, diffMs, startObj),
            (activeSession) => this.onTimerStateChange(activeSession)
        );

        // Initial render
        this.renderItemsManagement();
        this.renderMainItems();
        this.updateTodayTotalTime();
        this.renderHistory();
        this.updateUserNameDisplay();
        this.updateLastBackupDisplay();

        // Initial summary
        ChartsAPI.init();
        ChartsAPI.renderSummary('day');
        this.bindSummaryActions();
        this.bindStackActions();

        // Tutorial Check
        if (!StorageAPI.getTutorialShown()) {
            this.showTutorialModal();
        }
    },

    // --- Navigation ---
    bindNavigation: function () {
        const links = document.querySelectorAll('.nav-links a');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.dataset.target;

                // Update active link
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Update view
                document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(target).classList.add('active');

                this.currentView = target;

                // Reset scroll position to top
                const contentArea = document.querySelector('.content-area');
                if (contentArea) {
                    contentArea.scrollTop = 0;
                }
                window.scrollTo(0, 0);

                // Triggers when switching views
                if (target === 'main-view') {
                    this.renderMainItems();
                    this.updateTodayTotalTime();
                } else if (target === 'history-view') {
                    this.renderHistory();
                    this.updateFilterDropdown();
                } else if (target === 'summary-view') {
                    ChartsAPI.renderSummary(document.querySelector('.tab-btn.active').dataset.period);
                } else if (target === 'items-view') {
                    this.renderItemsManagement();
                }
            });
        });
    },

    // --- Main View (Timer) ---
    bindTimerActions: function () {
        document.getElementById('btn-stop-task').addEventListener('click', () => {
            this.showConfirm('確認', '作業を終了しますか？', () => {
                const session = TimerAPI.stop();
                if (session) {
                    this.updateTodayTotalTime();
                    this.renderMainItems(); // update today's time on cards
                }
            });
        });

        // Use event delegation for start buttons (as they are dynamically added)
        document.getElementById('main-items-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-start-task');
            if (btn) {
                const itemId = btn.dataset.id;

                try {
                    TimerAPI.start(itemId);
                    // Move view to top if needed
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } catch (error) {
                    if (error.message === "ALREADY_RUNNING") {
                        // Already running this task
                        return;
                    } else {
                        this.showConfirm('確認', '現在実行中のタスクがあります。終了して新しいタスクを開始しますか？', () => {
                            TimerAPI.stop();
                            TimerAPI.start(itemId);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        });
                    }
                }
            }
        });
    },

    onTimerStateChange: function (activeSession) {
        const wrapper = document.getElementById('active-task-wrapper');
        const grid = document.getElementById('main-items-grid');

        if (activeSession) {
            const item = StorageAPI.getItem(activeSession.itemId);
            if (!item) return; // Item was deleted while running

            wrapper.style.display = 'block';
            document.getElementById('running-task-name').textContent = item.name;
            const start = new Date(activeSession.startTime);
            document.getElementById('running-start-time').textContent =
                String(start.getHours()).padStart(2, '0') + ':' + String(start.getMinutes()).padStart(2, '0');

            // Adjust header style
            document.querySelector('.active-task-card').style.borderColor = item.color;

            // Re-render items to disable start buttons
            this.renderMainItems();

        } else {
            wrapper.style.display = 'none';
            // Re-render items to enable start buttons
            this.renderMainItems();
        }
    },

    onTimerTick: function (formattedTime, diffMs, startObj) {
        if (this.currentView === 'main-view' || document.getElementById('active-task-wrapper').style.display === 'block') {
            document.getElementById('running-time-display').textContent = formattedTime;
        }
    },

    renderMainItems: function () {
        const items = StorageAPI.getItems();
        const grid = document.getElementById('main-items-grid');
        const activeSession = StorageAPI.getActiveSession();

        if (items.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>アイテムが登録されていません。<br>「アイテム管理」から追加してください。</p></div>';
            return;
        }

        grid.innerHTML = '';

        // Calculate today's time per item
        const todayStr = this.getTodayDateString();
        const sessions = StorageAPI.getSessions().filter(s => s.date === todayStr);

        items.forEach(item => {
            const todayTimeMs = sessions
                .filter(s => s.itemId === item.id)
                .reduce((total, s) => total + s.durationMs, 0);

            const isCurrentlyRunning = activeSession && activeSession.itemId === item.id;

            const card = document.createElement('div');
            card.className = 'item-card';
            card.style.setProperty('--item-color', item.color);

            card.innerHTML = `
                <div>
                    <div class="item-header">
                        <span class="item-name">${this.escapeHTML(item.name)}</span>
                        ${isCurrentlyRunning ? '<span class="status-badge"><i class="fa-solid fa-spinner fa-spin"></i> 計測中</span>' : ''}
                    </div>
                    <p class="item-today-time">今日の作業: ${TimerAPI.formatDuration(todayTimeMs)}</p>
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary btn-start-task" data-id="${item.id}" style="width: 100%;" ${isCurrentlyRunning ? 'disabled' : ''}>
                        <i class="fa-solid fa-play"></i> 開始
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    updateTodayTotalTime: function () {
        const todayStr = this.getTodayDateString();
        const sessions = StorageAPI.getSessions().filter(s => s.date === todayStr);
        const totalMs = sessions.reduce((total, s) => total + s.durationMs, 0);
        document.getElementById('today-total-time').textContent = TimerAPI.formatDuration(totalMs);
    },

    // --- Items Management ---
    bindItemsManagement: function () {
        document.getElementById('form-add-item').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('item-name').value.trim();
            const color = document.getElementById('item-color').value;

            if (name) {
                StorageAPI.saveItem({ name, color });
                document.getElementById('item-name').value = '';
                this.renderItemsManagement();
                // Update other views if needed
                if (this.currentView !== 'items-view') this.renderMainItems();
            }
        });

        document.getElementById('items-table-body').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const id = target.dataset.id;
            if (target.classList.contains('btn-delete-item')) {
                this.showConfirm('確認', 'このアイテムを削除しますか？\n（関連する過去の作業履歴には影響しません）', () => {
                    StorageAPI.deleteItem(id);
                    this.renderItemsManagement();
                });
            } else if (target.classList.contains('btn-edit-item')) {
                e.preventDefault();
                const item = StorageAPI.getItem(id);
                if (item) {
                    const modal = document.getElementById('modal-edit-item');
                    document.getElementById('edit-item-id').value = item.id;
                    document.getElementById('edit-item-name').value = item.name;
                    document.getElementById('edit-item-color').value = item.color;
                    modal.classList.add('active');
                }
            }
        });

        // Edit Modal Actions
        const editModal = document.getElementById('modal-edit-item');
        const closeEditModal = () => {
            editModal.classList.remove('active');
        };

        editModal.querySelectorAll('.close-edit-modal').forEach(btn => {
            btn.addEventListener('click', closeEditModal);
        });

        document.getElementById('btn-save-edit-item').addEventListener('click', () => {
            const id = document.getElementById('edit-item-id').value;
            const newName = document.getElementById('edit-item-name').value.trim();
            const newColor = document.getElementById('edit-item-color').value;

            if (newName && id) {
                const item = StorageAPI.getItem(id);
                if (item) {
                    StorageAPI.saveItem({ ...item, name: newName, color: newColor });
                    closeEditModal();
                    this.renderItemsManagement();
                    this.renderMainItems();
                    this.renderHistory();

                    // Re-render summary if it's the active view
                    if (this.currentView === 'summary-view') {
                        ChartsAPI.renderSummary(document.querySelector('.tab-btn.active').dataset.period);
                    }
                }
            }
        });
    },

    renderItemsManagement: function () {
        const items = StorageAPI.getItems();
        const tbody = document.getElementById('items-table-body');

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;" class="text-muted">アイテムが登録されていません。</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(item => `
            <tr>
                <td><span class="color-dot" style="background-color: ${item.color};"></span> ${item.color}</td>
                <td style="font-weight: 500;">${this.escapeHTML(item.name)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-outline btn-edit-item" data-id="${item.id}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-outline-danger btn-delete-item" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // --- History View ---
    bindHistoryActions: function () {
        // Filters
        document.getElementById('btn-apply-filter').addEventListener('click', () => {
            this.renderHistory();
        });

        // Copy as Text
        document.getElementById('btn-copy-history-text').addEventListener('click', () => {
            let sessions = StorageAPI.getSessions();

            // Apply current filters
            const filterItem = document.getElementById('filter-item').value;
            const filterDateFrom = document.getElementById('filter-date-from').value;
            const filterDateTo = document.getElementById('filter-date-to').value;

            if (filterItem) sessions = sessions.filter(s => s.itemId === filterItem);
            if (filterDateFrom) sessions = sessions.filter(s => s.date >= filterDateFrom);
            if (filterDateTo) sessions = sessions.filter(s => s.date <= filterDateTo);

            if (sessions.length === 0) {
                App.showCopyEmptyModal();
                return;
            }

            const items = StorageAPI.getItems();
            const aggregated = {};

            items.forEach(i => {
                aggregated[i.id] = { name: i.name, durationMs: 0 };
            });

            sessions.forEach(s => {
                if (aggregated[s.itemId]) {
                    aggregated[s.itemId].durationMs += s.durationMs;
                }
            });

            const sortedData = Object.values(aggregated)
                .filter(d => Math.floor(d.durationMs / 1000) > 0) // >= 1 second
                .sort((a, b) => b.durationMs - a.durationMs);

            if (sortedData.length === 0) {
                App.showCopyEmptyModal();
                return;
            }

            const textLines = sortedData.map(d => `✅️ ${d.name}：${TimerAPI.formatDurationJp(d.durationMs)}`);

            const userName = StorageAPI.getUserName();
            if (userName) {
                textLines.unshift(`👤 ${userName}`);
            }

            const textToCopy = textLines.join('\n');

            const fallbackCopyTextToClipboard = (text) => {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.top = "0";
                textArea.style.left = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        App.showCopySuccessModal();
                    } else {
                        App.showCopyErrorModal();
                    }
                } catch (err) {
                    console.error('Fallback copy failed', err);
                    App.showCopyErrorModal('実行時エラーが発生しました。');
                }
                document.body.removeChild(textArea);
            };

            if (navigator.clipboard) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    App.showCopySuccessModal();
                }).catch(err => {
                    console.warn('Clipboard API failed, using fallback: ', err);
                    fallbackCopyTextToClipboard(textToCopy);
                });
            } else {
                fallbackCopyTextToClipboard(textToCopy);
            }
        });

        // Delete Session
        document.getElementById('history-table-body').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.classList.contains('btn-delete-session')) {
                this.showConfirm('確認', 'この記録を削除しますか？', () => {
                    StorageAPI.deleteSession(target.dataset.id);
                    this.renderHistory();
                    this.updateTodayTotalTime();
                });
            }
        });

        // Modal triggers
        const modal = document.getElementById('modal-manual-record');

        document.getElementById('btn-add-manual-record').addEventListener('click', () => {
            this.updateFilterDropdown('manual-item');
            document.getElementById('form-manual-record').reset();
            document.getElementById('manual-record-id').value = '';
            document.getElementById('manual-date').value = this.getTodayDateString();
            modal.classList.add('active');
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.classList.remove('active'));
        });

        const formManualRecord = document.getElementById('form-manual-record');
        formManualRecord.addEventListener('submit', (e) => {
            e.preventDefault();
        });

        document.getElementById('btn-save-manual-record').addEventListener('click', () => {
            const endInput = document.getElementById('manual-end');
            endInput.setCustomValidity(''); // Reset previous errors

            if (!formManualRecord.reportValidity()) return;

            const itemId = document.getElementById('manual-item').value;
            const dateStr = document.getElementById('manual-date').value;
            const startStr = document.getElementById('manual-start').value;
            const endStr = endInput.value;

            const startD = new Date(`${dateStr}T${startStr}`);
            const endD = new Date(`${dateStr}T${endStr}`);

            if (endD <= startD) {
                endInput.setCustomValidity('終了時刻は開始時刻より後に設定してください。');
                endInput.reportValidity();
                return;
            }

            const session = {
                itemId: itemId,
                date: dateStr,
                startTime: startStr,
                endTime: endStr,
                durationMs: endD - startD
            };

            StorageAPI.saveSession(session);
            modal.classList.remove('active');
            this.renderHistory();
            this.updateTodayTotalTime();
        });
    },

    updateFilterDropdown: function (targetId = 'filter-item') {
        const select = document.getElementById(targetId);
        const currentVal = select.value;
        const items = StorageAPI.getItems();

        let html = targetId === 'filter-item' ? '<option value="">すべて</option>' : '';
        html += items.map(i => `<option value="${i.id}">${this.escapeHTML(i.name)}</option>`).join('');

        select.innerHTML = html;
        if (currentVal) select.value = currentVal;
    },

    renderHistory: function () {
        let sessions = StorageAPI.getSessions();
        const tbody = document.getElementById('history-table-body');

        // Apply filters
        const filterItem = document.getElementById('filter-item').value;
        const filterDateFrom = document.getElementById('filter-date-from').value;
        const filterDateTo = document.getElementById('filter-date-to').value;

        if (filterItem) sessions = sessions.filter(s => s.itemId === filterItem);
        if (filterDateFrom) sessions = sessions.filter(s => s.date >= filterDateFrom);
        if (filterDateTo) sessions = sessions.filter(s => s.date <= filterDateTo);

        // Calculate and update filtered total time
        const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
        document.getElementById('history-filtered-time').textContent = TimerAPI.formatDuration(totalMs);

        if (sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;" class="text-muted">該当する記録がありません。</td></tr>';
            return;
        }

        const items = StorageAPI.getItems();

        tbody.innerHTML = sessions.map(session => {
            const item = items.find(i => i.id === session.itemId) || { name: '不明なアイテム', color: '#ccc' };
            return `
                <tr>
                    <td>${session.date}</td>
                    <td><span class="color-dot" style="background-color: ${item.color};"></span> ${this.escapeHTML(item.name)}</td>
                    <td>${session.startTime}</td>
                    <td>${session.endTime}</td>
                    <td>${TimerAPI.formatDuration(session.durationMs)}</td>
                    <td>
                        <button class="icon-btn text-danger btn-delete-session" data-id="${session.id}" title="削除"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // --- Summary & Charts (Delegation to ChartsAPI mainly) ---
    bindSummaryActions: function () {
        document.querySelectorAll('.tabs-container .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tabs-container .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ChartsAPI.renderSummary(btn.dataset.period);
            });
        });

        document.getElementById('btn-prev-period').addEventListener('click', () => {
            const period = document.querySelector('.tab-btn.active').dataset.period;
            ChartsAPI.navigatePeriod(period, -1);
        });

        document.getElementById('btn-next-period').addEventListener('click', () => {
            const period = document.querySelector('.tab-btn.active').dataset.period;
            ChartsAPI.navigatePeriod(period, 1);
        });
    },

    // --- Settings ---
    bindSettingsActions: function () {
        document.getElementById('form-user-name').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('setting-user-name').value.trim();
            StorageAPI.setUserName(name);
            this.updateUserNameDisplay();
            App.createAndShowCustomModal('通知', '登録者名を保存しました。');
        });

        document.getElementById('btn-export-json').addEventListener('click', () => {
            const jsonStr = StorageAPI.exportData();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            const userName = StorageAPI.getUserName();
            const namePart = userName ? `${userName}-` : '';
            a.download = `work-time-tracker-${namePart}backup.json`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Record last backup date
            const now = new Date();
            const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            StorageAPI.setLastBackupDate(dateStr);
            this.updateLastBackupDisplay();
        });

        document.getElementById('btn-import-trigger').addEventListener('click', () => {
            document.getElementById('file-import-json').click();
        });

        document.getElementById('file-import-json').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                this.showConfirm('確認', 'このバックアップを復元すると、現在のデータを上書きします。よろしいですか？', () => {
                    const success = StorageAPI.importData(event.target.result);
                    if (success) {
                        App.showAlert('通知', 'インポートが完了しました。ページをリロードします。', () => location.reload());
                    } else {
                        App.showAlert('エラー', 'インポートに失敗しました。ファイル形式が正しいか確認してください。');
                    }
                });
                e.target.value = ''; // reset
            };
            reader.readAsText(file);
        });

        document.getElementById('btn-clear-data').addEventListener('click', () => {
            this.showConfirm('危険な操作', '本当にすべてのデータを削除しますか？\nこの操作は元に戻せません。', () => {
                this.showConfirm('最終確認', '本当にすべて削除しますね？', () => {
                    StorageAPI.clearAllData();
                    App.showAlert('通知', 'データを削除しました。ページをリロードします。', () => location.reload());
                });
            });
        });
    },

    // --- Tutorial ---
    bindTutorialActions: function () {
        const modal = document.getElementById('modal-tutorial');
        const btnOk = document.getElementById('btn-tutorial-ok');
        const chkDontShow = document.getElementById('chk-tutorial-dont-show');

        document.getElementById('btn-show-tutorial').addEventListener('click', () => {
            this.showTutorialModal();
        });

        const closeModal = () => {
            if (chkDontShow.checked) {
                StorageAPI.setTutorialShown(true);
            }
            modal.classList.remove('active');
        };

        btnOk.addEventListener('click', closeModal);
    },

    // --- Stack (Today's Achievement) ---
    bindStackActions: function () {
        const periodSelect = document.getElementById('stack-period-select');
        const customDateDiv = document.getElementById('stack-custom-date');
        const btnGenerate = document.getElementById('btn-generate-stack');

        periodSelect.addEventListener('change', () => {
            if (periodSelect.value === 'custom') {
                customDateDiv.style.display = 'block';
            } else {
                customDateDiv.style.display = 'none';
            }
        });

        btnGenerate.addEventListener('click', () => {
            let startDate, endDate;
            const now = new Date();

            if (periodSelect.value === 'today') {
                startDate = this.getTodayDateString();
                endDate = startDate;
            } else if (periodSelect.value === 'yesterday') {
                const y = new Date(now);
                y.setDate(now.getDate() - 1);
                startDate = this.formatDate(y);
                endDate = startDate;
            } else if (periodSelect.value === 'week') {
                const wStart = new Date(now);
                wStart.setDate(now.getDate() - now.getDay()); // Sunday
                startDate = this.formatDate(wStart);
                endDate = this.getTodayDateString();
            } else if (periodSelect.value === 'custom') {
                startDate = document.getElementById('stack-date-from').value;
                endDate = document.getElementById('stack-date-to').value;
                if (!startDate || !endDate) {
                    this.showAlert('エラー', '期間を選択してください。');
                    return;
                }
            }

            this.generateStackResults(startDate, endDate);
        });

        // Copy buttons
        document.getElementById('btn-copy-stack-msg').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('stack-output-msg').value);
        });
        document.getElementById('btn-copy-stack-prompt-ja').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('stack-output-prompt-ja').value);
        });
        document.getElementById('btn-copy-stack-prompt-en').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('stack-output-prompt-en').value);
        });
    },

    generateStackResults: function (startDate, endDate) {
        let sessions = StorageAPI.getSessions();
        sessions = sessions.filter(s => s.date >= startDate && s.date <= endDate);

        if (sessions.length === 0) {
            this.showAlert('通知', '指定期間の作業履歴がありません。');
            document.getElementById('stack-results').style.display = 'none';
            return;
        }

        // Aggregate time per item
        const itemTotals = {};
        let totalDuration = 0;

        sessions.forEach(s => {
            if (!itemTotals[s.itemId]) {
                itemTotals[s.itemId] = 0;
            }
            itemTotals[s.itemId] += s.durationMs;
            totalDuration += s.durationMs;
        });

        const sortedItems = Object.keys(itemTotals).map(id => {
            const item = StorageAPI.getItem(id);
            return {
                name: item ? item.name : '不明なアイテム',
                duration: itemTotals[id]
            };
        }).sort((a, b) => b.duration - a.duration);

        const topItem = sortedItems[0];
        document.getElementById('stack-result-total-time').textContent = TimerAPI.formatDuration(totalDuration);
        document.getElementById('stack-result-top-item').textContent = topItem.name;

        // Base text generation
        let postMsg = '';
        sortedItems.forEach(i => {
            postMsg += `✅ ${i.name} ${TimerAPI.formatDuration(i.duration)}\n`;
        });
        postMsg += `\n今日は${topItem.name}がいちばん進みました。少しずつでも積み上げられてうれしいです。`;
        document.getElementById('stack-output-msg').value = postMsg;

        // Generate dynamic prompts based on topItem.name
        const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const promptDict = {
            '読書': {
                places: ['自室', '窓辺', 'カフェ', '図書館'],
                times: ['朝', '昼', '夕方', '夜'],
                atmospheres: ['やさしい', '落ち着いた', 'さわやか', 'ほっこり'],
                items: ['マグカップ', '本棚', 'しおり', '観葉植物'],
                placesEn: ['in a cozy room', 'by the window', 'at a cafe', 'in a library'],
                timesEn: ['morning light', 'daytime', 'sunset', 'night time'],
                atmospheresEn: ['gentle atmosphere', 'calm and relaxing', 'refreshing vibe', 'warm and cozy'],
                itemsEn: ['with a mug', 'near a bookshelf', 'with a bookmark', 'with houseplants']
            },
            '散歩': {
                places: ['公園', '川沿い', '住宅街', '緑道'],
                times: ['朝', '昼下がり', '夕焼け', '夜'],
                atmospheres: ['すがすがしい', 'のどかな', 'リフレッシュ', '静かな'],
                items: ['スニーカー', 'ベンチ', '木漏れ日', '可愛い犬'],
                placesEn: ['in a park', 'along the river', 'in a quiet neighborhood', 'on a green path'],
                timesEn: ['morning', 'early afternoon', 'sunset', 'night'],
                atmospheresEn: ['refreshing', 'peaceful', 'rejuvenating', 'silent'],
                itemsEn: ['sneakers', 'a park bench', 'sunlight filtering through trees', 'a cute dog']
            },
            '勉強': {
                places: ['ノートパソコン', 'デスク', 'スタバ', '勉強机'],
                times: ['深夜', '早朝', '午後', '夕暮れ'],
                atmospheres: ['集中している', '静かな', '頑張っている', 'おしゃれな'],
                items: ['コーヒー', '文房具', '付箋', '参考書'],
                placesEn: ['with a laptop', 'at a desk', 'at a Starbucks', 'at a study desk'],
                timesEn: ['late night', 'early morning', 'afternoon', 'dusk'],
                atmospheresEn: ['focused', 'quiet', 'hardworking', 'stylish'],
                itemsEn: ['coffee', 'stationery', 'sticky notes', 'textbooks']
            },
            'default': {
                places: ['机', '部屋', '外', 'お気に入りの場所'],
                times: ['朝', '昼', '夕方', '夜'],
                atmospheres: ['明るい', '落ち着いた', '達成感のある', '穏やかな'],
                items: ['コーヒー', 'ノート', '時計', '観葉植物'],
                placesEn: ['at a desk', 'in a room', 'outside', 'at a favorite place'],
                timesEn: ['morning', 'daytime', 'evening', 'night'],
                atmospheresEn: ['bright', 'calm', 'feeling accomplished', 'peaceful'],
                itemsEn: ['coffee', 'a notebook', 'a clock', 'houseplants']
            }
        };

        // Find best match or fallback
        let dict = promptDict['default'];
        for (const key in promptDict) {
            if (topItem.name.includes(key)) {
                dict = promptDict[key];
                break;
            }
        }

        const pPlace = randomElement(dict.places);
        const pTime = randomElement(dict.times);
        const pAtm = randomElement(dict.atmospheres);
        const pItem = randomElement(dict.items);

        const pPlaceEn = randomElement(dict.placesEn);
        const pTimeEn = randomElement(dict.timesEn);
        const pAtmEn = randomElement(dict.atmospheresEn);
        const pItemEn = randomElement(dict.itemsEn);

        const jaPrompt = `${topItem.name}をしている風景、場所は${pPlace}、時間帯は${pTime}、${pAtm}雰囲気で、${pItem}が描かれている、高画質、アニメスタイル`;
        const enPrompt = `A scenery of someone doing ${topItem.name}, ${pPlaceEn}, ${pTimeEn}, ${pAtmEn}, ${pItemEn}, high quality, anime style`;

        document.getElementById('stack-output-prompt-ja').value = jaPrompt;
        document.getElementById('stack-output-prompt-en').value = enPrompt;

        document.getElementById('stack-results').style.display = 'block';
    },

    showTutorialModal: function () {
        const modal = document.getElementById('modal-tutorial');
        const chkDontShow = document.getElementById('chk-tutorial-dont-show');
        chkDontShow.checked = StorageAPI.getTutorialShown();
        modal.classList.add('active');
    },

    // --- Utilities ---
    getTodayDateString: function () {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    updateUserNameDisplay: function () {
        const userName = StorageAPI.getUserName();
        const displayEl = document.getElementById('display-user-name');
        const inputEl = document.getElementById('setting-user-name');

        if (displayEl) {
            displayEl.textContent = userName ? `登録者: ${this.escapeHTML(userName)}` : '登録者: 未設定';
        }
        if (inputEl) {
            inputEl.value = userName;
        }
    },

    escapeHTML: function (str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    },

    showConfirm: function (title, message, onOk) {
        const modal = document.getElementById('modal-confirm');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        const btnClose = modal.querySelector('.close-confirm');

        const closeModal = () => modal.classList.remove('active');

        btnCancel.onclick = closeModal;
        btnClose.onclick = closeModal;

        btnOk.onclick = () => {
            closeModal();
            if (onOk) onOk();
        };

        modal.classList.add('active');
    },

    showAlert: function (title, message, onOk) {
        const modal = document.getElementById('modal-alert');
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-message').textContent = message;

        const btnOk = document.getElementById('btn-alert-ok');
        const btnClose = modal.querySelector('.close-alert');

        const closeModal = () => modal.classList.remove('active');

        btnClose.onclick = closeModal;

        btnOk.onclick = () => {
            closeModal();
            if (onOk) onOk();
        };

        modal.classList.add('active');
    },

    // --- Specific Modals for Copy Feature ---
    showCopySuccessModal: function () {
        this.createAndShowCustomModal('通知', 'コピーしました');
    },

    showCopyErrorModal: function (detail) {
        this.createAndShowCustomModal('エラー', 'コピーに失敗しました' + (detail ? '\n' + detail : ''));
    },

    showCopyEmptyModal: function () {
        this.createAndShowCustomModal('通知', 'コピー対象のデータがありません');
    },

    createAndShowCustomModal: function (title, message) {
        // Prevent multiple modals
        const existing = document.getElementById('custom-dynamic-modal');
        if (existing) {
            document.body.removeChild(existing);
        }

        const overlay = document.createElement('div');
        overlay.id = 'custom-dynamic-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';

        const modalBox = document.createElement('div');
        modalBox.style.backgroundColor = 'var(--bg-card, #fff)';
        modalBox.style.padding = '30px';
        modalBox.style.borderRadius = 'var(--border-radius, 8px)';
        modalBox.style.boxShadow = 'var(--shadow-md, 0 10px 25px rgba(0,0,0,0.2))';
        modalBox.style.minWidth = '320px';
        modalBox.style.textAlign = 'center';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.margin = '0 0 16px 0';
        titleEl.style.fontSize = '1.25rem';
        titleEl.style.color = 'var(--text-main, #333)';

        const msgEl = document.createElement('p');
        msgEl.textContent = message;
        msgEl.style.margin = '0 0 24px 0';
        msgEl.style.whiteSpace = 'pre-wrap';
        msgEl.style.color = 'var(--text-main, #333)';
        msgEl.style.fontSize = '1rem';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'btn btn-primary';
        okBtn.style.padding = '10px 24px';
        okBtn.style.fontSize = '1rem';
        okBtn.style.cursor = 'pointer';

        okBtn.onclick = () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        modalBox.appendChild(titleEl);
        modalBox.appendChild(msgEl);
        modalBox.appendChild(okBtn);
        overlay.appendChild(modalBox);

        document.body.appendChild(overlay);
    },

    updateLastBackupDisplay: function () {
        const lastBackupLabel = document.getElementById('label-last-backup');
        if (!lastBackupLabel) return;
        const lastDate = StorageAPI.getLastBackupDate();
        if (lastDate) {
            lastBackupLabel.textContent = `最後のバックアップ：${lastDate}`;
        } else {
            lastBackupLabel.textContent = 'まだバックアップされていません';
        }
    }
};
