const ChartsAPI = {
    barChartInstance: null,
    pieChartInstance: null,
    currentDateReference: new Date(),

    init: function () {
        // Set Chart.js defaults for aesthetics
        Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
        Chart.defaults.color = "#6c757d";
    },

    navigatePeriod: function (period, direction) {
        const d = new Date(this.currentDateReference);

        switch (period) {
            case 'day':
                d.setDate(d.getDate() + direction);
                break;
            case 'week':
                d.setDate(d.getDate() + (direction * 7));
                break;
            case 'month':
                d.setMonth(d.getMonth() + direction);
                break;
            case 'year':
                d.setFullYear(d.getFullYear() + direction);
                break;
        }

        this.currentDateReference = d;
        this.renderSummary(period);
    },

    renderSummary: function (period) {
        // Build date range based on period and reference date
        let startDate, endDate, labelStr;
        const ref = new Date(this.currentDateReference);

        if (period === 'day') {
            startDate = new Date(ref.setHours(0, 0, 0, 0));
            endDate = new Date(ref.setHours(23, 59, 59, 999));
            labelStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
        } else if (period === 'week') {
            // week starting Monday
            const day = ref.getDay() || 7;
            startDate = new Date(ref);
            startDate.setDate(ref.getDate() - day + 1);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);

            labelStr = `${startDate.getMonth() + 1}/${startDate.getDate()} 〜 ${endDate.getMonth() + 1}/${endDate.getDate()}`;
        } else if (period === 'month') {
            startDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
            endDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
            labelStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
        } else if (period === 'year') {
            startDate = new Date(ref.getFullYear(), 0, 1);
            endDate = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
            labelStr = `${startDate.getFullYear()}年`;
        } else {
            // all
            startDate = new Date(0); // 1970
            endDate = new Date('2100-01-01');
            labelStr = '全期間';
            this.currentDateReference = new Date(); // reset to today feeling
        }

        // Update Nav UI
        document.getElementById('current-period-label').textContent = labelStr;
        const navContainer = document.getElementById('period-nav-container');
        navContainer.style.display = period === 'all' ? 'none' : 'flex';

        // Gather Data
        const allSessions = StorageAPI.getSessions();
        const items = StorageAPI.getItems();

        let filteredSessions = allSessions;
        if (period !== 'all') {
            filteredSessions = allSessions.filter(s => {
                const sDate = new Date(s.date + 'T' + s.startTime);
                return sDate >= startDate && sDate <= endDate;
            });
        }

        // Aggregate by itemId
        const aggregated = {};
        items.forEach(i => {
            aggregated[i.id] = {
                name: i.name,
                color: i.color,
                durationMs: 0
            };
        });

        let totalMs = 0;
        filteredSessions.forEach(s => {
            if (aggregated[s.itemId]) {
                aggregated[s.itemId].durationMs += s.durationMs;
                totalMs += s.durationMs;
            }
        });

        // Update Total Time UI
        document.getElementById('summary-total-time').textContent = TimerAPI.formatDuration(totalMs);

        // Prepare chart data (sort by duration desc)
        const sortedData = Object.values(aggregated)
            .filter(d => d.durationMs > 0)
            .sort((a, b) => b.durationMs - a.durationMs);

        this.drawPieChart(sortedData);
        this.drawBarChart(sortedData); // Show all items for bar chart
    },

    drawPieChart: function (dataArray) {
        const ctx = document.getElementById('pieChart').getContext('2d');

        if (this.pieChartInstance) {
            this.pieChartInstance.destroy();
        }

        if (dataArray.length === 0) {
            this.drawEmptyChart(ctx, 'データがありません');
            return;
        }

        const labels = dataArray.map(d => d.name);
        const data = dataArray.map(d => d.durationMs / 1000); // Seconds
        const bgColors = dataArray.map(d => d.color);

        this.pieChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = dataArray[context.dataIndex].durationMs;
                                return ` ${context.label}: ${TimerAPI.formatDuration(val)}`;
                            }
                        }
                    }
                }
            }
        });
    },

    drawBarChart: function (dataArray) {
        const ctx = document.getElementById('barChart').getContext('2d');

        if (this.barChartInstance) {
            this.barChartInstance.destroy();
        }

        if (dataArray.length === 0) {
            this.drawEmptyChart(ctx, '');
            return;
        }

        const labels = dataArray.map(d => d.name);
        const data = dataArray.map(d => d.durationMs / 1000); // Seconds
        const bgColors = dataArray.map(d => d.color);

        this.barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '作業時間',
                    data: data,
                    backgroundColor: bgColors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return TimerAPI.formatDuration(value * 1000);
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = dataArray[context.dataIndex].durationMs;
                                return ` ${TimerAPI.formatDuration(val)}`;
                            }
                        }
                    }
                }
            }
        });
    },

    drawEmptyChart: function (ctx, text) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter';
        ctx.fillStyle = '#adb5bd';
        ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
};
