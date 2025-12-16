// 전역 변수 초기화
window.__timelineLoopCount = window.__timelineLoopCount || 0;
window.__timelineFlags = new Set(); 
window.__persistentUnlocks = window.__persistentUnlocks || new Set(); // ★ [신규] 해금 상태 영구 저장소

// 속도 변수
window.__scrollSpeed = 0.6; 

// 속도 조절 함수
window.adjustSpeed = function(delta) {
  let newSpeed = window.__scrollSpeed + delta;
  if (newSpeed < 0.1) newSpeed = 0.1;
  if (newSpeed > 5.0) newSpeed = 5.0;
  
  window.__scrollSpeed = parseFloat(newSpeed.toFixed(1));
  const speedEl = document.getElementById('speed-value');
  if (speedEl) speedEl.textContent = window.__scrollSpeed.toFixed(1);
};

// 시계 업데이트
window.updateClock = function(timelineCells, timelineContainer) {
  if (!timelineCells.length || !timelineContainer) return;
  
  const clockElement = document.getElementById('clock-time');
  const clockDateElement = document.getElementById('clock-date');
  
  const viewportCenter = timelineContainer.scrollTop + (timelineContainer.clientHeight / 2);
  let closestCell = null;
  let minDistance = Infinity;
  
  timelineCells.forEach(cell => {
    const dist = Math.abs((cell.offsetTop + cell.offsetHeight / 2) - viewportCenter);
    if (dist < minDistance) { minDistance = dist; closestCell = cell; }
  });
  
  if (closestCell) {
    const timeText = closestCell.querySelector('.cell-time').textContent.trim();
    if (clockElement && clockElement.textContent !== timeText) {
      clockElement.textContent = timeText;
    }
    const dateText = closestCell.getAttribute('data-date-text');
    if (clockDateElement && dateText && clockDateElement.textContent !== dateText) {
      clockDateElement.textContent = dateText;
    }
  }
};

window.throttle = function(func, wait) {
  let timeout;
  return function() {
    if (!timeout) {
      timeout = setTimeout(() => { timeout = null; func.apply(this, arguments); }, wait);
    }
  };
};

// 메인 초기화 함수
window.initTimeline = function() {
  const container = document.getElementById('timeline');
  if (!container) { setTimeout(window.initTimeline, 100); return; }
  
  const cells = Array.from(container.querySelectorAll('.timeline-cell'));
  if (!cells.length) { setTimeout(window.initTimeline, 100); return; }

  // 1. 원본 데이터 백업
  if (!window.__originalTimelineData) {
      window.__originalTimelineData = JSON.parse(JSON.stringify(setup.timeline));
  }

  // 2. 타이머/이벤트 정리
  if (window.__scrollTimer) {
      clearInterval(window.__scrollTimer);
      window.__scrollTimer = null;
  }
  container.onscroll = null; 

  const loopEl = document.getElementById('clock-loop-count');
  const updateLoopDisplay = () => {
    if (loopEl) loopEl.textContent = '루프: ' + window.__timelineLoopCount;
  };
  updateLoopDisplay();

  /* 콘텐츠 업데이트 함수 */
  function updateContentByLoop() {
    const currentLoop = window.__timelineLoopCount;
    const currentFlags = window.__timelineFlags || new Set();

    cells.forEach(cell => {
      const timeId = cell.getAttribute('data-time-id');
      const dataItem = setup.timeline.find(item => item.timeId === timeId);
      
      if (!dataItem) return;

      let targetIndex = 0; 
      if (dataItem.loopTriggers) {
        dataItem.loopTriggers.forEach(trigger => {
          if (currentLoop >= trigger.loop) targetIndex = trigger.index;
        });
      }
      if (dataItem.conditionTriggers) {
        dataItem.conditionTriggers.forEach(cond => {
          const allMet = cond.required.every(flag => currentFlags.has(flag));
          if (allMet) targetIndex = cond.index;
        });
      }

      const newText = dataItem.scripts[targetIndex];
      const textEl = cell.querySelector('.cell-text');
      const currentRenderedIdx = parseInt(cell.getAttribute('data-current-script-idx') ?? -1);

      if (currentRenderedIdx !== targetIndex || textEl.innerHTML !== newText) {
         textEl.innerHTML = newText;
         cell.setAttribute('data-current-script-idx', targetIndex);
      }
    });
    
    setupActions();
  }

  /* 액션 파싱 및 설정 */
  function setupActions() {
    const timeIdPattern = "\\d{2}-\\d{2}";
    const flagPattern = "(?:\\s+#([a-zA-Z0-9_가-힣]+))?";
    
    const timeScriptPair = `${timeIdPattern}\\s*->\\s*\\d+`;
    const multiplePairs = `${timeScriptPair}(?:,\\s*${timeScriptPair})*`;
    window.__multiplePairsPattern = multiplePairs; // ★ 정규식 패턴 전역 저장 (나중에 재사용)

    const triggerTargetPattern = `${timeIdPattern}:\\d+:\\([^\\)]+\\)`;
    const multipleTriggerTargets = `${triggerTargetPattern}(?:,\\s*${triggerTargetPattern})*`;

    const triggerRegex = new RegExp(`\\[([^\\[\\]:]+?):(${multipleTriggerTargets})\\s*${flagPattern}\\]`, 'g');
    const activeRegex = new RegExp(`\\[([^\\[\\]:]+?)(?::(${multiplePairs}))?${flagPattern}\\]`, 'g');
    const inactiveRegex = new RegExp(`\\(([^\\[\\():]+):(${multiplePairs})${flagPattern}\\)`, 'g');

    function parseTriggerTargets(targetsStr) {
        if (!targetsStr) return [];
        const list = targetsStr.split(',').map(s => s.trim());
        return list.map(item => {
        const match = item.match(/(\d{2}-\d{2}):(\d+):\(([^)]+)\)/);
        if (match) return { timeId: match[1], scriptIdx: parseInt(match[2], 10), label: match[3] };
        return null;
        }).filter(Boolean);
    }

    function parseActionTargets(targetsStr) {
        if (!targetsStr) return [];
        const pairs = targetsStr.split(',').map(s => s.trim());
        return pairs.map(pair => {
        const match = pair.match(/(\d{2}-\d{2})\s*->\s*(\d+)/);
        if (match) return { timeId: match[1], scriptIdx: parseInt(match[2], 10) };
        return null;
        }).filter(Boolean);
    }

    cells.forEach(cell => {
        const textEl = cell.querySelector('.cell-text');
        if (!textEl) return;
        let html = textEl.textContent;

        html = html.replace(triggerRegex, (match, txt, targetsStr, flagName) => {
        const targets = parseTriggerTargets(targetsStr);
        const targetsJson = encodeURIComponent(JSON.stringify(targets));
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        const safeMatch = match.replace(/"/g, '&quot;'); 
        return `<span class="timeline-trigger" data-triggers="${targetsJson}" data-full-string="${safeMatch}" ${flagAttr}>${txt}</span>`;
        });

        html = html.replace(activeRegex, (match, txt, targetsStr, flagName) => {
        const targets = targetsStr ? parseActionTargets(targetsStr) : [];
        const targetsJson = encodeURIComponent(JSON.stringify(targets));
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        const safeMatch = match.replace(/"/g, '&quot;');
        return `<span class="timeline-action active" data-targets="${targetsJson}" data-full-string="${safeMatch}" ${flagAttr}>${txt}</span>`;
        });

        html = html.replace(inactiveRegex, (_, txt, targetsStr, flagName) => {
        const targets = parseActionTargets(targetsStr);
        const targetsJson = encodeURIComponent(JSON.stringify(targets));
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action inactive" data-targets="${targetsJson}" data-label="${txt}" ${flagAttr}>${txt}</span>`;
        });

        if (html !== textEl.textContent) textEl.innerHTML = html;
    });

    attachClickHandler(); 
  }

  /* 클릭 핸들러 (해금 상태 저장 로직 추가됨) */
  function attachClickHandler() {
    const container = document.getElementById('timeline');
    if (!container) return;

    container.onclick = function(e) {
        const trigger = e.target.closest('.timeline-trigger');
        const activeAction = e.target.closest('.timeline-action.active');
        const action = activeAction; 
        const target = trigger || action;

        if (!target) return;
        e.preventDefault(); e.stopPropagation();

        // 플래그 획득
        const flagName = target.getAttribute('data-flag');
        let flagAcquired = false;
        if (flagName) {
            window.__timelineFlags = window.__timelineFlags || new Set();
            if (!window.__timelineFlags.has(flagName)) {
                window.__timelineFlags.add(flagName);
                flagAcquired = true;
            }
        }
        if (flagAcquired) updateContentByLoop();

        let executionSuccess = false;

        if (trigger) {
            const triggersJson = trigger.getAttribute('data-triggers');
            if (triggersJson) {
                try {
                const targets = JSON.parse(decodeURIComponent(triggersJson));
                targets.forEach(targetItem => {
                    const dataItem = setup.timeline.find(item => item.timeId === targetItem.timeId);
                    if (!dataItem || !dataItem.scripts[targetItem.scriptIdx]) return;
                    
                    const targetScript = dataItem.scripts[targetItem.scriptIdx];
                    const label = targetItem.label;
                    
                    // 정규식 패턴 생성 (setupActions와 동일한 로직)
                    const multiplePairsPattern = window.__multiplePairsPattern || "\\d{2}-\\d{2}\\s*->\\s*\\d+(?:,\\s*\\d{2}-\\d{2}\\s*->\\s*\\d+)*";
                    const pattern = new RegExp(`\\(${label}:(${multiplePairsPattern})(?:\\s+#([a-zA-Z0-9_가-힣]+))?\\)`);
                    
                    const newScript = targetScript.replace(pattern, (match, targetsStr, nextFlag) => {
                        const flagPart = nextFlag ? ` #${nextFlag}` : '';
                        return `[${label}:${targetsStr}${flagPart}]`;
                    });
                    
                    if (newScript !== targetScript) {
                        dataItem.scripts[targetItem.scriptIdx] = newScript;
                        
                        // ★★★ [신규] 해금 성공 시, 이 상태를 영구 저장소에 기록 ★★★
                        // 포맷: "시간ID|스크립트인덱스|라벨명"
                        const unlockKey = `${targetItem.timeId}|${targetItem.scriptIdx}|${label}`;
                        window.__persistentUnlocks.add(unlockKey);

                        // 화면 갱신
                        const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetItem.timeId}"]`);
                        if(targetCell) {
                            const currentIdx = parseInt(targetCell.getAttribute('data-current-script-idx') || 0);
                            if (currentIdx === targetItem.scriptIdx) {
                                targetCell.querySelector('.cell-text').textContent = newScript;
                            }
                        }
                    }
                });
                executionSuccess = true;
                } catch (err) { console.error("Trigger parse error:", err); }
            }
        } else if (action) {
            // ... (기존 액션 로직 동일) ...
            const targetsJson = target.getAttribute('data-targets');
            if (targetsJson) {
                try {
                const targets = JSON.parse(decodeURIComponent(targetsJson));
                targets.forEach(targetInfo => {
                    const dataItem = setup.timeline.find(item => item.timeId === targetInfo.timeId);
                    if (dataItem && dataItem.scripts[targetInfo.scriptIdx]) {
                    const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetInfo.timeId}"]`);
                    if(targetCell) {
                        targetCell.querySelector('.cell-text').textContent = dataItem.scripts[targetInfo.scriptIdx];
                        targetCell.setAttribute('data-current-script-idx', targetInfo.scriptIdx);
                    }
                    }
                });
                executionSuccess = true;
                } catch (err) { console.error(err); }
            } else {
                // 하위 호환성
                const targetId = target.getAttribute('data-target-id');
                const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
                if (targetId && !isNaN(scriptIdx)) {
                const dataItem = setup.timeline.find(item => item.timeId === targetId);
                if (dataItem && dataItem.scripts[scriptIdx]) {
                    const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
                    if(targetCell) {
                        targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
                        targetCell.setAttribute('data-current-script-idx', scriptIdx);
                        executionSuccess = true;
                    }
                }
                }
            }
        }

        // 자기 자신 비활성화 (Executed 처리)
        if (executionSuccess || flagAcquired) {
            const currentCell = target.closest('.timeline-cell');
            if (currentCell) {
                const currentTimeId = currentCell.getAttribute('data-time-id');
                const currentIdx = parseInt(currentCell.getAttribute('data-current-script-idx') || 0);
                const currentDataItem = setup.timeline.find(item => item.timeId === currentTimeId);
                const fullString = target.getAttribute('data-full-string');
                const labelText = target.textContent;

                if (currentDataItem && fullString) {
                    let scriptContent = currentDataItem.scripts[currentIdx];
                    const disabledHtml = `<span class="timeline-executed">${labelText}</span>`;
                    currentDataItem.scripts[currentIdx] = scriptContent.replace(fullString, disabledHtml);
                    currentCell.querySelector('.cell-text').innerHTML = currentDataItem.scripts[currentIdx];
                    setupActions(); 
                }
            }
        }
    };
  }
  
  updateContentByLoop(); 

  const handleScroll = window.throttle(() => window.updateClock(cells, container), 100);
  container.onscroll = handleScroll;
  window.updateClock(cells, container);

  let isAutoScrolling = false;
  
  setTimeout(() => {
    isAutoScrolling = true; 
    let preciseScrollTop = container.scrollTop;
    
    window.__scrollTimer = setInterval(() => {
      if (!isAutoScrolling) return;

      if (Math.abs(container.scrollTop - preciseScrollTop) > 1) {
        preciseScrollTop = container.scrollTop;
      }

      // ★★★ 바닥 도달 시: 초기화 + 해금 상태 복구 ★★★
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
        window.__timelineLoopCount++;
        if (loopEl) loopEl.textContent = '루프: ' + window.__timelineLoopCount;
        
        // 1. 단서(플래그) 초기화 -> 버튼을 다시 누를 수 있게 됨
        window.__timelineFlags.clear();

        // 2. 원본 데이터 복구 -> 텍스트가 'Executed'에서 다시 '버튼'으로 돌아감
        if (window.__originalTimelineData) {
            setup.timeline.forEach((item, index) => {
                item.scripts = [...window.__originalTimelineData[index].scripts];
            });
        }

        // 3. ★★★ [신규] 영구 해금된 트리거(Hidden Word) 재적용 ★★★
        if (window.__persistentUnlocks && window.__persistentUnlocks.size > 0) {
            window.__persistentUnlocks.forEach(key => {
                const [pTimeId, pScriptIdxStr, pLabel] = key.split('|');
                const pScriptIdx = parseInt(pScriptIdxStr, 10);
                
                const dataItem = setup.timeline.find(item => item.timeId === pTimeId);
                if (dataItem && dataItem.scripts[pScriptIdx]) {
                    // 원본은 (라벨:...) 형태이므로 이를 다시 [라벨:...]로 치환
                    let targetScript = dataItem.scripts[pScriptIdx];
                    const multiplePairsPattern = window.__multiplePairsPattern || "\\d{2}-\\d{2}\\s*->\\s*\\d+(?:,\\s*\\d{2}-\\d{2}\\s*->\\s*\\d+)*";
                    const pattern = new RegExp(`\\(${pLabel}:(${multiplePairsPattern})(?:\\s+#([a-zA-Z0-9_가-힣]+))?\\)`);
                    
                    targetScript = targetScript.replace(pattern, (match, targetsStr, nextFlag) => {
                         const flagPart = nextFlag ? ` #${nextFlag}` : '';
                         return `[${pLabel}:${targetsStr}${flagPart}]`; 
                    });
                    dataItem.scripts[pScriptIdx] = targetScript;
                }
            });
        }

        // 4. 화면 리셋 및 갱신
        cells.forEach(cell => {
             cell.setAttribute('data-current-script-idx', '-1');
        });
        
        container.scrollTop = 0;
        preciseScrollTop = 0;
        
        updateContentByLoop();
        window.updateClock(cells, container);
        
      } else {
        preciseScrollTop += window.__scrollSpeed; 
        container.scrollTop = preciseScrollTop;
      }
    }, 16);
    
    setInterval(() => { if (isAutoScrolling) window.updateClock(cells, container); }, 100);
  }, 600);
};

// SugarCube 로드 대기
jQuery(document).one(':storyready', function() { setTimeout(window.initTimeline, 100); });
jQuery(document).on(':passagedisplay', function() { setTimeout(window.initTimeline, 100); });