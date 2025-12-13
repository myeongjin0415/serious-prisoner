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
    const flagPattern = "(?:[:\\s]+#([a-zA-Z0-9_가-힣]+))?";
    const triggerRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern}):(\\d+):\\(([^\\)]+)\\)${flagPattern}\\]`, 'g');
    const activeRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern})\\s*->\\s*(\\d+)${flagPattern}\\]`, 'g');
    const inactiveRegex = new RegExp(`\\(([^\\[\\]:]+):(${timeIdPattern})\\s*->\\s*(\\d+)${flagPattern}\\)`, 'g');
  
    cells.forEach(cell => {
      const textEl = cell.querySelector('.cell-text');
      if (!textEl) return;
      let html = textEl.textContent;
  
      html = html.replace(triggerRegex, (_, txt, timeId, sIdx, lbl, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-trigger" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${lbl}" ${flagAttr}>${txt}</span>`;
      });
      html = html.replace(activeRegex, (_, txt, timeId, sIdx, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action active" data-target-id="${timeId}" data-script-idx="${sIdx}" ${flagAttr}>${txt}</span>`;
      });
      html = html.replace(inactiveRegex, (_, txt, timeId, sIdx, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action inactive" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${txt}" ${flagAttr}>${txt}</span>`;
      });
  
      if (html !== textEl.textContent) textEl.innerHTML = html;
    });
  
    container.onclick = function(e) {
      const trigger = e.target.closest('.timeline-trigger');
      const action = e.target.closest('.timeline-action.active');
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
  
      const targetId = target.getAttribute('data-target-id');
      const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
      
      if (flagAcquired) {
         updateContentByLoop();
      }
  
      const dataItem = setup.timeline.find(item => item.timeId === targetId);
      if (!dataItem || !dataItem.scripts[scriptIdx]) return;
      const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
  
      if (trigger) {
        const label = target.getAttribute('data-label');
        const targetScript = dataItem.scripts[scriptIdx];
        const pattern = new RegExp(`\\(${label}:(${timeIdPattern})\\s*->\\s*(\\d+)(?:[:\\s]+#([a-zA-Z0-9_가-힣]+))?\\)`);
        
        const newScript = targetScript.replace(pattern, function(match, nextTimeId, nextScriptIdx, nextFlag) {
            const flagPart = nextFlag ? ` #${nextFlag}` : '';
            return `[${label}:${nextTimeId} -> ${nextScriptIdx}${flagPart}]`;
        });
        
        if (newScript !== targetScript) {
          dataItem.scripts[scriptIdx] = newScript;
          if(targetCell) targetCell.querySelector('.cell-text').textContent = newScript;
          setupActions(); 
        }
      } else {
        if(targetCell) {
            targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
            setupActions();
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