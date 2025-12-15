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

 /* 액션 파싱 로직 (수정됨) */
function setupActions() {
  const timeIdPattern = "\\d{2}-\\d{2}";
  const flagPattern = "(?:\\s+#([a-zA-Z0-9_가-힣]+))?";
  
  // 1. 기존 액션(Active/Inactive)용 패턴: "08-15 -> 1"
  const timeScriptPair = `${timeIdPattern}\\s*->\\s*\\d+`;
  const multiplePairs = `${timeScriptPair}(?:,\\s*${timeScriptPair})*`;
  window.__multiplePairsPattern = multiplePairs; // 전역 저장

  // 2. 트리거 타겟용 패턴 (새로 추가): "13-15:1:(라벨)"
  // 형식: 시간ID:인덱스:(라벨)
  const triggerTargetPattern = `${timeIdPattern}:\\d+:\\([^\\)]+\\)`;
  // 여러 개 허용: "타겟1, 타겟2, 타겟3"
  const multipleTriggerTargets = `${triggerTargetPattern}(?:,\\s*${triggerTargetPattern})*`;

  // 정규식 정의
  // 그룹 1: 텍스트, 그룹 2: 타겟목록(문자열), 그룹 3: 플래그
  const triggerRegex = new RegExp(`\\[([^\\[\\]:]+):(${multipleTriggerTargets})\\s*${flagPattern}\\]`, 'g');
  const activeRegex = new RegExp(`\\[([^\\[\\]:]+):(${multiplePairs})${flagPattern}\\]`, 'g');
  const inactiveRegex = new RegExp(`\\(([^\\[\\():]+):(${multiplePairs})${flagPattern}\\)`, 'g');

  // 트리거 타겟 문자열 파싱 함수 ("13-15:1:(A), 13-20:2:(B)" -> 객체 배열)
  function parseTriggerTargets(targetsStr) {
    const list = targetsStr.split(',').map(s => s.trim());
    return list.map(item => {
      // "13-15:1:(메아리)" 형식 파싱
      const match = item.match(/(\d{2}-\d{2}):(\d+):\(([^)]+)\)/);
      if (match) {
        return {
          timeId: match[1],
          scriptIdx: parseInt(match[2], 10),
          label: match[3]
        };
      }
      return null;
    }).filter(Boolean);
  }

  // 액션 타겟 문자열 파싱 함수
  function parseActionTargets(targetsStr) {
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

    // 트리거 치환 (JSON으로 데이터 저장)
    html = html.replace(triggerRegex, (_, txt, targetsStr, flagName) => {
      const targets = parseTriggerTargets(targetsStr);
      const targetsJson = encodeURIComponent(JSON.stringify(targets));
      const flagAttr = flagName ? `data-flag="${flagName}"` : '';
      // data-triggers 속성에 배열 저장
      return `<span class="timeline-trigger" data-triggers="${targetsJson}" ${flagAttr}>${txt}</span>`;
    });

    // Active 액션 치환
    html = html.replace(activeRegex, (_, txt, targetsStr, flagName) => {
      const targets = parseActionTargets(targetsStr);
      const targetsJson = encodeURIComponent(JSON.stringify(targets));
      const flagAttr = flagName ? `data-flag="${flagName}"` : '';
      return `<span class="timeline-action active" data-targets="${targetsJson}" ${flagAttr}>${txt}</span>`;
    });

    // Inactive 액션 치환
    html = html.replace(inactiveRegex, (_, txt, targetsStr, flagName) => {
      const targets = parseActionTargets(targetsStr);
      const targetsJson = encodeURIComponent(JSON.stringify(targets));
      const flagAttr = flagName ? `data-flag="${flagName}"` : '';
      return `<span class="timeline-action inactive" data-targets="${targetsJson}" data-label="${txt}" ${flagAttr}>${txt}</span>`;
    });

    if (html !== textEl.textContent) textEl.innerHTML = html;
  });

  // (onclick 핸들러는 아래에서 별도로 설명)
  attachClickHandler(); 
}

function attachClickHandler() {
  const container = document.getElementById('timeline');
  if (!container) return;

  container.onclick = function(e) {
    const trigger = e.target.closest('.timeline-trigger');
    
    // [수정 1] 오직 'active' 상태인 액션만 찾습니다. ('inactive'는 무시)
    const activeAction = e.target.closest('.timeline-action.active');
    
    // [수정 2] action 변수에는 activeAction만 할당됩니다.
    const action = activeAction; 
    const target = trigger || action;

    // target이 없으면(즉, inactive를 클릭했거나 빈 공간 클릭 시) 아무 일도 안 함
    if (!target) return;
    
    e.preventDefault(); e.stopPropagation();

    // 플래그 획득 로직 (공통)
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

    // 1. 트리거(해금 버튼) 처리 로직
    if (trigger) {
      const triggersJson = trigger.getAttribute('data-triggers');
      if (!triggersJson) return;

      try {
          const targets = JSON.parse(decodeURIComponent(triggersJson));
          
          targets.forEach(targetItem => {
              const targetId = targetItem.timeId;
              const scriptIdx = targetItem.scriptIdx;
              const label = targetItem.label;

              const dataItem = setup.timeline.find(item => item.timeId === targetId);
              if (!dataItem || !dataItem.scripts[scriptIdx]) return;

              const targetScript = dataItem.scripts[scriptIdx];
              
              // (Label:...) -> [Label:...] 변환 패턴
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
                if(targetCell) {
                    const currentIdx = parseInt(targetCell.getAttribute('data-current-script-idx') || 0);
                    if (currentIdx === scriptIdx) {
                        targetCell.querySelector('.cell-text').textContent = newScript;
                    }
                }
              }
          });
          setupActions();

      } catch (err) {
          console.error("Trigger parse error:", err);
      }

    } 
    // 2. 액션(즉시 실행) 처리 로직
    // [수정 3] inactiveAction 처리 로직을 완전히 삭제했으므로, 여기는 activeAction일 때만 실행됩니다.
    else if (action) {
      const targetsJson = target.getAttribute('data-targets');
      
      // 구버전(단일 타겟) 하위 호환
      if (!targetsJson) {
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

      // 신버전(다중 타겟) 처리
      try {
        const targets = JSON.parse(decodeURIComponent(targetsJson));
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
      } catch (err) { console.error(err); }
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