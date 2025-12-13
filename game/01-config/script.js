// 전역 루프 카운터
window.__timelineLoopCount = window.__timelineLoopCount || 0;
window.__timelineFlags = new Set(); 

const scrollSpeed = 0.6;

// 시계 업데이트 함수
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

// 초기화 함수
window.initTimeline = function() {
  const container = document.getElementById('timeline');
  // 컨테이너가 없으면 재시도
  if (!container) { setTimeout(window.initTimeline, 100); return; }
  
  const cells = Array.from(container.querySelectorAll('.timeline-cell'));
  if (!cells.length) { setTimeout(window.initTimeline, 100); return; }

  // ★ [수정 1] 기존에 실행 중이던 스크롤 타이머가 있다면 강제로 종료합니다.
  if (window.__scrollTimer) {
      clearInterval(window.__scrollTimer);
      window.__scrollTimer = null;
  }

  // ★ [수정 2] 기존 스크롤 이벤트 리스너 제거를 위해 onscroll 속성 사용 (가장 확실한 방법)
  // 기존 addEventListener는 누적되므로, onscroll에 덮어씌워서 하나만 유지되게 함
  container.onscroll = null; 


  // 루프 카운터 표시
  const loopEl = document.getElementById('clock-loop-count');
  const updateLoopDisplay = () => {
    if (loopEl) loopEl.textContent = '루프: ' + window.__timelineLoopCount;
  };
  updateLoopDisplay();

  /* 루프 카운트/플래그에 따라 콘텐츠 업데이트하는 함수 */
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
          if (currentLoop >= trigger.loop) {
            targetIndex = trigger.index;
          }
        });
      }

      if (dataItem.conditionTriggers) {
        dataItem.conditionTriggers.forEach(cond => {
          const allMet = cond.required.every(flag => currentFlags.has(flag));
          if (allMet) {
            targetIndex = cond.index;
          }
        });
      }

      const newText = dataItem.scripts[targetIndex];
      const textEl = cell.querySelector('.cell-text');
      const currentRenderedIdx = parseInt(cell.getAttribute('data-current-script-idx') || 0);

      if (currentRenderedIdx !== targetIndex || textEl.textContent !== newText) {
         textEl.innerHTML = newText;
         cell.setAttribute('data-current-script-idx', targetIndex);
      }
    });
    setupActions();
  }

  /* 액션 파싱 로직 */
  function setupActions() {
    const timeIdPattern = "\\d{2}-\\d{2}";
    const flagPattern = "(?:\\s+#([a-zA-Z0-9_가-힣]+))?";
    // 시간-스크립트 쌍 패턴: "08-15 -> 1" 또는 "08-15->1"
    const timeScriptPair = `${timeIdPattern}\\s*->\\s*\\d+`;
    // 여러 쌍 패턴: "08-15 -> 1, 08-30->2" (쉼표로 구분)
    const multiplePairs = `${timeScriptPair}(?:,\\s*${timeScriptPair})*`;
    
    // 클릭 핸들러에서도 사용할 수 있도록 전역에 저장
    window.__multiplePairsPattern = multiplePairs;
    
    const triggerRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern}):(\\d+):\\(([^\\)]+)\\)${flagPattern}\\]`, 'g');
    const activeRegex = new RegExp(`\\[([^\\[\\]:]+):(${multiplePairs})${flagPattern}\\]`, 'g');
    const inactiveRegex = new RegExp(`\\(([^\\[\\():]+):(${multiplePairs})${flagPattern}\\)`, 'g');
  
    // 시간-스크립트 문자열을 파싱하여 배열로 변환
    function parseTargets(targetsStr) {
      const pairs = targetsStr.split(',').map(s => s.trim());
      return pairs.map(pair => {
        const match = pair.match(/(\d{2}-\d{2})\s*->\s*(\d+)/);
        if (match) {
          return { timeId: match[1], scriptIdx: parseInt(match[2], 10) };
        }
        return null;
      }).filter(Boolean);
    }
  
    cells.forEach(cell => {
      const textEl = cell.querySelector('.cell-text');
      if (!textEl) return;
      let html = textEl.textContent;
  
      html = html.replace(triggerRegex, (_, txt, timeId, sIdx, lbl, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-trigger" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${lbl}" ${flagAttr}>${txt}</span>`;
      });
      html = html.replace(activeRegex, (_, txt, targetsStr, flagName) => {
        const targets = parseTargets(targetsStr);
        const targetsJson = encodeURIComponent(JSON.stringify(targets));
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action active" data-targets="${targetsJson}" ${flagAttr}>${txt}</span>`;
      });
      html = html.replace(inactiveRegex, (_, txt, targetsStr, flagName) => {
        const targets = parseTargets(targetsStr);
        const targetsJson = encodeURIComponent(JSON.stringify(targets));
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action inactive" data-targets="${targetsJson}" data-label="${txt}" ${flagAttr}>${txt}</span>`;
      });
  
      if (html !== textEl.textContent) textEl.innerHTML = html;
    });
  
    container.onclick = function(e) {
      const trigger = e.target.closest('.timeline-trigger');
      const activeAction = e.target.closest('.timeline-action.active');
      const inactiveAction = e.target.closest('.timeline-action.inactive');
      const action = activeAction || inactiveAction;
      const target = trigger || action;
  
      if (!target) return;
      e.preventDefault(); e.stopPropagation();
  
      const flagName = target.getAttribute('data-flag');
      let flagAcquired = false;
  
      if (flagName) {
          window.__timelineFlags = window.__timelineFlags || new Set();
          if (!window.__timelineFlags.has(flagName)) {
            window.__timelineFlags.add(flagName);
            flagAcquired = true;
          }
      }
      
      if (flagAcquired) {
         updateContentByLoop();
      }
  
      if (trigger) {
        // 트리거 처리 (기존 로직 유지)
        const targetId = target.getAttribute('data-target-id');
        const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
        const label = target.getAttribute('data-label');
        const dataItem = setup.timeline.find(item => item.timeId === targetId);
        if (!dataItem || !dataItem.scripts[scriptIdx]) return;
        
        const targetScript = dataItem.scripts[scriptIdx];
        const timeIdPatternLocal = "\\d{2}-\\d{2}";
        const timeScriptPairLocal = `${timeIdPatternLocal}\\s*->\\s*\\d+`;
        const multiplePairsPattern = `${timeScriptPairLocal}(?:,\\s*${timeScriptPairLocal})*`;
        const pattern = new RegExp(`\\(${label}:(${multiplePairsPattern})(?:\\s+#([a-zA-Z0-9_가-힣]+))?\\)`);
        
        const newScript = targetScript.replace(pattern, function(match, targetsStr, nextFlag) {
            const flagPart = nextFlag ? ` #${nextFlag}` : '';
            return `[${label}:${targetsStr}${flagPart}]`;
        });
        
        if (newScript !== targetScript) {
          dataItem.scripts[scriptIdx] = newScript;
          const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
          if(targetCell) targetCell.querySelector('.cell-text').textContent = newScript;
          setupActions(); 
        }
      } else if (action) {
        // inactive 액션 처리: 여러 타겟 변경 + inactive를 active로 변환
        if (inactiveAction) {
          const label = inactiveAction.getAttribute('data-label');
          const targetsJson = inactiveAction.getAttribute('data-targets');
          
          if (!label || !targetsJson) return;
          
          try {
            const targets = JSON.parse(decodeURIComponent(targetsJson));
            
            // 여러 타겟의 스크립트 변경
            targets.forEach(targetInfo => {
              const dataItem = setup.timeline.find(item => item.timeId === targetInfo.timeId);
              if (dataItem && dataItem.scripts[targetInfo.scriptIdx]) {
                const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetInfo.timeId}"]`);
                if(targetCell) {
                  const cellTextEl = targetCell.querySelector('.cell-text');
                  if (cellTextEl) {
                    cellTextEl.textContent = dataItem.scripts[targetInfo.scriptIdx];
                  }
                }
              }
            });
            
            // 모든 타겟 셀에서 (label:...) 형식을 [label:...] 형식으로 변환
            const timeIdPatternLocal = "\\d{2}-\\d{2}";
            const timeScriptPairLocal = `${timeIdPatternLocal}\\s*->\\s*\\d+`;
            const multiplePairsPattern = `${timeScriptPairLocal}(?:,\\s*${timeScriptPairLocal})*`;
            const pattern = new RegExp(`\\(${label}:(${multiplePairsPattern})(?:\\s+#([a-zA-Z0-9_가-힣]+))?\\)`, 'g');
            
            targets.forEach(targetInfo => {
              const dataItem = setup.timeline.find(item => item.timeId === targetInfo.timeId);
              if (dataItem && dataItem.scripts[targetInfo.scriptIdx]) {
                const targetScript = dataItem.scripts[targetInfo.scriptIdx];
                const newScript = targetScript.replace(pattern, function(match, targetsStr, nextFlag) {
                  const flagPart = nextFlag ? ` #${nextFlag}` : '';
                  return `[${label}:${targetsStr}${flagPart}]`;
                });
                
                if (newScript !== targetScript) {
                  dataItem.scripts[targetInfo.scriptIdx] = newScript;
                  const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetInfo.timeId}"]`);
                  if(targetCell) {
                    const cellTextEl = targetCell.querySelector('.cell-text');
                    if (cellTextEl) {
                      cellTextEl.textContent = newScript;
                    }
                  }
                }
              }
            });
            
            setupActions();
          } catch (err) {
            console.error('Failed to parse targets:', err);
          }
          return;
        }
        
        // 활성 링크 처리 (여러 타겟 지원)
        const targetsJson = target.getAttribute('data-targets');
        if (!targetsJson) {
          // 기존 단일 타겟 형식 지원 (하위 호환)
          const targetId = target.getAttribute('data-target-id');
          const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
          if (targetId && !isNaN(scriptIdx)) {
            const dataItem = setup.timeline.find(item => item.timeId === targetId);
            if (dataItem && dataItem.scripts[scriptIdx]) {
              const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
              if(targetCell) {
                targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
                setupActions();
              }
            }
          }
          return;
        }
        
        try {
          const targets = JSON.parse(decodeURIComponent(targetsJson));
          // 여러 타겟에 대해 모두 처리
          targets.forEach(targetInfo => {
            const dataItem = setup.timeline.find(item => item.timeId === targetInfo.timeId);
            if (dataItem && dataItem.scripts[targetInfo.scriptIdx]) {
              const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetInfo.timeId}"]`);
              if(targetCell) {
                targetCell.querySelector('.cell-text').textContent = dataItem.scripts[targetInfo.scriptIdx];
              }
            }
          });
          setupActions();
        } catch (err) {
          console.error('Failed to parse targets:', err);
        }
      }
    };
  }
  
  updateContentByLoop(); 

  const handleScroll = window.throttle(() => window.updateClock(cells, container), 100);
  
  // ★ [수정 3] addEventListener 대신 onscroll 속성에 할당하여 중복 방지
  container.onscroll = handleScroll;
  
  window.updateClock(cells, container);

  let isAutoScrolling = false;
  
  // ★ [수정 4] 600ms 후 실행될 때도, 이전에 예약된 초기화 타임아웃이 있다면 클리어 로직 필요하지만,
  // 여기서는 간단히 로직 내부에서 타이머를 전역변수에 할당하는 것으로 처리
  setTimeout(() => {
    isAutoScrolling = true; 
    let preciseScrollTop = container.scrollTop;
    
    // ★ [수정 5] setInterval의 ID를 window.__scrollTimer 전역 변수에 저장
    window.__scrollTimer = setInterval(() => {
      if (!isAutoScrolling) return;

      if (Math.abs(container.scrollTop - preciseScrollTop) > 1) {
        preciseScrollTop = container.scrollTop;
      }

      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
        window.__timelineLoopCount++;
        updateLoopDisplay();
        
        container.scrollTop = 0;
        preciseScrollTop = 0;
        
        updateContentByLoop();
        window.updateClock(cells, container);
      } else {
        preciseScrollTop += scrollSpeed; 
        container.scrollTop = preciseScrollTop;
      }
    }, 16);
    
    // updateClock용 인터벌은 부하가 적어 놔둘 수도 있지만, 동일하게 관리 권장
    // 여기서는 일단 생략
    setInterval(() => { if (isAutoScrolling) window.updateClock(cells, container); }, 100);
  }, 600);
};

// SugarCube 로드 대기 (이벤트 중복 방지 로직이 추가되었으므로 안전함)
jQuery(document).one(':storyready', function() { setTimeout(window.initTimeline, 100); });
jQuery(document).on(':passagedisplay', function() { setTimeout(window.initTimeline, 100); });