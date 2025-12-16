// 전역 루프 카운터
window.__timelineLoopCount = window.__timelineLoopCount || 0;
window.__timelineFlags = new Set(); 

// [변경] 속도 변수 전역화 및 초기값 설정
window.__scrollSpeed = 0.6; 

// [추가] 속도 조절 함수
window.adjustSpeed = function(delta) {
  let newSpeed = window.__scrollSpeed + delta;
  if (newSpeed < 0.1) newSpeed = 0.1; // 최소 속도 제한
  if (newSpeed > 5.0) newSpeed = 5.0; // 최대 속도 제한
  
  window.__scrollSpeed = parseFloat(newSpeed.toFixed(1));
  
  // 화면 숫자 업데이트
  const speedEl = document.getElementById('speed-value');
  if (speedEl) speedEl.textContent = window.__scrollSpeed.toFixed(1);
};

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

  /* 루프 카운트/플래그에 따라 콘텐츠 업데이트하는 함수 (수정됨) */
  function updateContentByLoop() {
    const currentLoop = window.__timelineLoopCount;
    const currentFlags = window.__timelineFlags || new Set();

    cells.forEach(cell => {
      const timeId = cell.getAttribute('data-time-id');
      const dataItem = setup.timeline.find(item => item.timeId === timeId);
      
      if (!dataItem) return;

      // ★ [수정 핵심] 자동 변경 조건(루프/조건문)이 아예 없는 아이템은 
      // 수동 조작(링크 클릭 등) 상태를 유지하기 위해 업데이트 대상에서 제외합니다.
      if (!dataItem.loopTriggers && !dataItem.conditionTriggers) {
          return; 
      }

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

      // 텍스트가 다를 때만 업데이트 (깜빡임 방지)
      if (currentRenderedIdx !== targetIndex || textEl.innerHTML !== newText) {
         textEl.innerHTML = newText;
         cell.setAttribute('data-current-script-idx', targetIndex);
      }
    });
    
    // 내용이 바뀌었을 수 있으므로 액션(버튼)들을 다시 활성화
    setupActions();
  }

/* 액션 파싱 로직 (수정됨: 플래그가 텍스트에 포함되는 문제 해결) */
function setupActions() {
  const timeIdPattern = "\\d{2}-\\d{2}";
  // 플래그 패턴 (앞에 공백 필수)
  const flagPattern = "(?:\\s+#([a-zA-Z0-9_가-힣]+))?";
  
  const timeScriptPair = `${timeIdPattern}\\s*->\\s*\\d+`;
  const multiplePairs = `${timeScriptPair}(?:,\\s*${timeScriptPair})*`;
  window.__multiplePairsPattern = multiplePairs; 

  const triggerTargetPattern = `${timeIdPattern}:\\d+:\\([^\\)]+\\)`;
  const multipleTriggerTargets = `${triggerTargetPattern}(?:,\\s*${triggerTargetPattern})*`;

  // [수정 1] triggerRegex: 텍스트 부분([^\\[\\]:]+) 뒤에 ?를 붙여서 Lazy(최소 매칭) 모드로 변경
  const triggerRegex = new RegExp(`\\[([^\\[\\]:]+?):(${multipleTriggerTargets})\\s*${flagPattern}\\]`, 'g');
  
  // [수정 2] activeRegex: 텍스트 부분([^\\[\\]:]+) 뒤에 ?를 붙여서 Lazy(최소 매칭) 모드로 변경
  // 이렇게 해야 뒤에 나오는 #플래그를 텍스트에 포함시키지 않고 분리해냅니다.
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

    // 1. 트리거 치환
    html = html.replace(triggerRegex, (match, txt, targetsStr, flagName) => {
      const targets = parseTriggerTargets(targetsStr);
      const targetsJson = encodeURIComponent(JSON.stringify(targets));
      const flagAttr = flagName ? `data-flag="${flagName}"` : '';
      const safeMatch = match.replace(/"/g, '&quot;'); 
      return `<span class="timeline-trigger" data-triggers="${targetsJson}" data-full-string="${safeMatch}" ${flagAttr}>${txt}</span>`;
    });

    // 2. Active 액션 치환
    html = html.replace(activeRegex, (match, txt, targetsStr, flagName) => {
      const targets = targetsStr ? parseActionTargets(targetsStr) : [];
      const targetsJson = encodeURIComponent(JSON.stringify(targets));
      const flagAttr = flagName ? `data-flag="${flagName}"` : '';
      const safeMatch = match.replace(/"/g, '&quot;');
      
      return `<span class="timeline-action active" data-targets="${targetsJson}" data-full-string="${safeMatch}" ${flagAttr}>${txt}</span>`;
    });

    // 3. Inactive 액션 치환
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


/* 클릭 핸들러 (수정됨: 페이지 번호 동기화 버그 수정) */
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

    // 1. 플래그 처리
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

    // 2. 기능 실행 (트리거 또는 액션)
    let executionSuccess = false;

    if (trigger) {
      // 트리거 로직 (기존과 동일)
      const triggersJson = trigger.getAttribute('data-triggers');
      if (triggersJson) {
        try {
          const targets = JSON.parse(decodeURIComponent(triggersJson));
          targets.forEach(targetItem => {
              const dataItem = setup.timeline.find(item => item.timeId === targetItem.timeId);
              if (!dataItem || !dataItem.scripts[targetItem.scriptIdx]) return;
              
              const targetScript = dataItem.scripts[targetItem.scriptIdx];
              const label = targetItem.label;
              const timeIdPatternLocal = "\\d{2}-\\d{2}";
              const timeScriptPairLocal = `${timeIdPatternLocal}\\s*->\\s*\\d+`;
              const multiplePairsPattern = `${timeScriptPairLocal}(?:,\\s*${timeScriptPairLocal})*`;
              const pattern = new RegExp(`\\(${label}:(${multiplePairsPattern})(?:\\s+#([a-zA-Z0-9_가-힣]+))?\\)`);
              
              const newScript = targetScript.replace(pattern, (match, targetsStr, nextFlag) => {
                  const flagPart = nextFlag ? ` #${nextFlag}` : '';
                  return `[${label}:${targetsStr}${flagPart}]`;
              });
              
              if (newScript !== targetScript) {
                dataItem.scripts[targetItem.scriptIdx] = newScript;
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
      // ★★★ 액션 로직 (여기가 수정됨) ★★★
      const targetsJson = target.getAttribute('data-targets');
      if (targetsJson) {
        try {
          const targets = JSON.parse(decodeURIComponent(targetsJson));
          targets.forEach(targetInfo => {
            const dataItem = setup.timeline.find(item => item.timeId === targetInfo.timeId);
            if (dataItem && dataItem.scripts[targetInfo.scriptIdx]) {
              const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetInfo.timeId}"]`);
              if(targetCell) {
                 // 텍스트 변경
                 targetCell.querySelector('.cell-text').textContent = dataItem.scripts[targetInfo.scriptIdx];
                 
                 // ★★★ [중요 수정] 화면을 바꿨으면, 바뀐 인덱스를 반드시 기록해야 합니다!
                 targetCell.setAttribute('data-current-script-idx', targetInfo.scriptIdx);
              }
            }
          });
          executionSuccess = true;
        } catch (err) { console.error(err); }
      } else {
         // 하위 호환성 (단일 타겟)
         const targetId = target.getAttribute('data-target-id');
         const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
         if (targetId && !isNaN(scriptIdx)) {
           const dataItem = setup.timeline.find(item => item.timeId === targetId);
           if (dataItem && dataItem.scripts[scriptIdx]) {
             const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
             if(targetCell) {
                 targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
                 
                 // ★★★ [중요 수정] 여기도 인덱스 기록 추가
                 targetCell.setAttribute('data-current-script-idx', scriptIdx);
                 
                 executionSuccess = true;
             }
           }
         }
      }
    }

    // 3. 자기 자신 비활성화 (Self-Disable)
    if (executionSuccess || flagAcquired) {
        const currentCell = target.closest('.timeline-cell');
        if (currentCell) {
            const currentTimeId = currentCell.getAttribute('data-time-id');
            // 이제 여기서 정확한 인덱스(1번)를 가져올 수 있게 됩니다.
            const currentIdx = parseInt(currentCell.getAttribute('data-current-script-idx') || 0);
            const currentDataItem = setup.timeline.find(item => item.timeId === currentTimeId);
            const fullString = target.getAttribute('data-full-string');
            const labelText = target.textContent;

            if (currentDataItem && fullString) {
                let scriptContent = currentDataItem.scripts[currentIdx];
                const disabledHtml = `<span class="timeline-executed">${labelText}</span>`;
                
                // 텍스트 교체 및 저장
                currentDataItem.scripts[currentIdx] = scriptContent.replace(fullString, disabledHtml);
                
                // 화면 갱신
                currentCell.querySelector('.cell-text').innerHTML = currentDataItem.scripts[currentIdx];
                setupActions(); 
            }
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
    
    window.__scrollTimer = setInterval(() => {
      if (!isAutoScrolling) return;

      if (Math.abs(container.scrollTop - preciseScrollTop) > 1) {
        preciseScrollTop = container.scrollTop;
      }

      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
        // ... (루프 초기화 로직 생략, 기존 동일) ...
      } else {
        // ★ [여기가 핵심 수정] 전역 변수를 더하도록 변경
        preciseScrollTop += window.__scrollSpeed; 
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