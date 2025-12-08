// 전역 루프 카운터
window.__timelineLoopCount = window.__timelineLoopCount || 0;

window.__timelineFlags = new Set(); // 전역 플래그 저장소

// 시계 업데이트 함수 (수정됨)
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
    // 시간 업데이트
    const timeText = closestCell.querySelector('.cell-time').textContent.trim();
    if (clockElement && clockElement.textContent !== timeText) {
      clockElement.textContent = timeText;
    }
    
    // 날짜 업데이트 (Start 패시지에서 넣어둔 data-date-text 사용)
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
// 초기화 함수
window.initTimeline = function() {
  const container = document.getElementById('timeline');
  if (!container) { setTimeout(window.initTimeline, 100); return; }
  
  const cells = Array.from(container.querySelectorAll('.timeline-cell'));
  if (!cells.length) { setTimeout(window.initTimeline, 100); return; }

  // 루프 카운터 표시
  const loopEl = document.getElementById('clock-loop-count');
  const updateLoopDisplay = () => {
    if (loopEl) loopEl.textContent = '루프: ' + window.__timelineLoopCount;
  };
  updateLoopDisplay();

  /* ★ [추가됨] 루프 카운트에 따라 콘텐츠 업데이트하는 함수 ★ */
  function updateContentByLoop() {
    const currentLoop = window.__timelineLoopCount;
    // 현재 활성화된 플래그 세트 가져오기
    const currentFlags = window.__timelineFlags || new Set();

    cells.forEach(cell => {
      const timeId = cell.getAttribute('data-time-id');
      const dataItem = setup.timeline.find(item => item.timeId === timeId);
      
      if (!dataItem) return;

      let targetIndex = 0; // 기본값 (script 0)

      // 1. 루프 횟수 체크 (기존 로직)
      if (dataItem.loopTriggers) {
        dataItem.loopTriggers.forEach(trigger => {
          if (currentLoop >= trigger.loop) {
            targetIndex = trigger.index;
          }
        });
      }

      // 2. ★ 조건(플래그) 체크 (우선순위 높음) ★
      if (dataItem.conditionTriggers) {
        dataItem.conditionTriggers.forEach(cond => {
          // required 배열의 모든 플래그가 currentFlags에 있는지 확인
          const allMet = cond.required.every(flag => currentFlags.has(flag));
          if (allMet) {
            targetIndex = cond.index;
          }
        });
      }

      // 3. 내용 업데이트 (기존과 동일)
      const newText = dataItem.scripts[targetIndex];
      const textEl = cell.querySelector('.cell-text');
      const currentRenderedIdx = parseInt(cell.getAttribute('data-current-script-idx') || 0);

      // 텍스트가 다르거나, 인덱스가 다르면 업데이트
      if (currentRenderedIdx !== targetIndex || textEl.textContent !== newText) {
         textEl.innerHTML = newText; // innerHTML로 넣어야 태그가 먹힘 (초기화 시)
         cell.setAttribute('data-current-script-idx', targetIndex);
      }
    });

    // 텍스트가 바뀌었으니 액션 파싱 다시 수행
    setupActions();
  }

  /* 액션 파싱 로직 (기존 코드 유지) */
  function setupActions() {
    const timeIdPattern = "\\d{2}-\\d{2}-\\d{2}-\\d{2}";
    
    // 태그 패턴: 공백이나 콜론 뒤에 #이 오고 문자열, 그리고 닫는 괄호 직전
    // 그룹 1번이 태그명(Flag Name)이 됩니다.
    const flagPattern = "(?:[:\\s]+#([a-zA-Z0-9_가-힣]+))?";
  
    // 1. 트리거: [텍스트:시간:번호:(대상) #태그]
    // 순서: 텍스트(1) -> 시간(2) -> 번호(3) -> (대상라벨)(4) -> 태그(5)
    const triggerRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern}):(\\d+):\\(([^\\)]+)\\)${flagPattern}\\]`, 'g');
    
    // 2. 활성 액션: [텍스트:시간->번호 #태그]
    // 순서: 텍스트(1) -> 시간(2) -> 번호(3) -> 태그(4)
    const activeRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern})\\s*->\\s*(\\d+)${flagPattern}\\]`, 'g');
  
    // 3. 비활성 액션: (텍스트:시간->번호 #태그)
    // 순서: 텍스트(1) -> 시간(2) -> 번호(3) -> 태그(4)
    const inactiveRegex = new RegExp(`\\(([^\\[\\]:]+):(${timeIdPattern})\\s*->\\s*(\\d+)${flagPattern}\\)`, 'g');
  
    cells.forEach(cell => {
      const textEl = cell.querySelector('.cell-text');
      if (!textEl) return;
      let html = textEl.textContent;
  
      // 1. 트리거 변환 (그룹 인덱스 주의: 태그는 5번)
      html = html.replace(triggerRegex, (_, txt, timeId, sIdx, lbl, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-trigger" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${lbl}" ${flagAttr}>${txt}</span>`;
      });
  
      // 2. 활성 액션 변환 (그룹 인덱스 주의: 태그는 4번)
      html = html.replace(activeRegex, (_, txt, timeId, sIdx, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action active" data-target-id="${timeId}" data-script-idx="${sIdx}" ${flagAttr}>${txt}</span>`;
      });
  
      // 3. 비활성 액션 변환 (그룹 인덱스 주의: 태그는 4번)
      html = html.replace(inactiveRegex, (_, txt, timeId, sIdx, flagName) => {
        const flagAttr = flagName ? `data-flag="${flagName}"` : '';
        return `<span class="timeline-action inactive" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${txt}" ${flagAttr}>${txt}</span>`;
      });
  
      if (html !== textEl.textContent) textEl.innerHTML = html;
    });
  
    // 클릭 이벤트 핸들러
    container.onclick = function(e) {
      const trigger = e.target.closest('.timeline-trigger');
      const action = e.target.closest('.timeline-action.active');
      const target = trigger || action;
  
      if (!target) return;
      e.preventDefault(); e.stopPropagation();
  
      // ★ 플래그 처리 로직
      const flagName = target.getAttribute('data-flag');
      let flagAcquired = false;
  
      if (flagName) {
          window.__timelineFlags = window.__timelineFlags || new Set();
          if (!window.__timelineFlags.has(flagName)) {
            window.__timelineFlags.add(flagName);
            console.log("🚩 Flag Acquired:", flagName, window.__timelineFlags);
            flagAcquired = true;
          }
      }
  
      // 타겟 데이터 찾기
      const targetId = target.getAttribute('data-target-id');
      const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
      
      // 플래그 획득 시 전체 갱신 (화면 깜빡임 방지를 위해 로직 순서 주의)
      if (flagAcquired) {
         updateContentByLoop();
         // DOM이 갱신되었을 수 있으므로 target 관련 변수 재사용 주의
      }
  
      const dataItem = setup.timeline.find(item => item.timeId === targetId);
      if (!dataItem || !dataItem.scripts[scriptIdx]) return;
      const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
  
      if (trigger) {
        // 트리거 클릭 로직
        const label = target.getAttribute('data-label');
        const targetScript = dataItem.scripts[scriptIdx];
        
        // 대상 텍스트 안에서 (Label:ID->Idx #태그) 패턴을 찾음
        // 맨 뒤에 태그가 있을 수도 있고 없을 수도 있음
        const pattern = new RegExp(`\\(${label}:(${timeIdPattern})\\s*->\\s*(\\d+)(?:[:\\s]+#([a-zA-Z0-9_가-힣]+))?\\)`);
        
        const newScript = targetScript.replace(pattern, function(match, nextTimeId, nextScriptIdx, nextFlag) {
            // 태그가 있다면 유지하면서 대괄호[]로 변경
            const flagPart = nextFlag ? ` #${nextFlag}` : '';
            return `[${label}:${nextTimeId} -> ${nextScriptIdx}${flagPart}]`;
        });
        
        if (newScript !== targetScript) {
          dataItem.scripts[scriptIdx] = newScript;
          if(targetCell) {
             targetCell.querySelector('.cell-text').textContent = newScript;
          }
          setupActions(); 
        }
      } else {
        // Active Action 클릭 시 (단순 텍스트 갱신인 경우)
        if(targetCell) {
            targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
            setupActions();
        }
      }
    };
  }
  
  // ★ 최초 실행 시 루프 체크 수행
  updateContentByLoop(); 
  // setupActions는 updateContentByLoop 안에서 호출되므로 여기서 따로 호출 안 해도 됨

  // 스크롤 및 자동 재생
  const handleScroll = window.throttle(() => window.updateClock(cells, container), 100);
  container.addEventListener('scroll', handleScroll);
  // 초기 시계 업데이트
  window.updateClock(cells, container);

  let isAutoScrolling = false;
  setTimeout(() => {
    isAutoScrolling = true; 
    const speed = 30; 
    
    // 스크롤 루프
    setInterval(() => {
      if (!isAutoScrolling) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
        // ★ 루프 발생 시점
        window.__timelineLoopCount++;
        updateLoopDisplay();
        
        container.scrollTop = 0; // 맨 위로 이동
        
        // ★ 중요: 루프가 바뀌었으므로 텍스트 내용 업데이트 수행
        updateContentByLoop();
        
        window.updateClock(cells, container);
      } else {
        container.scrollTop += (speed * 16 / 1000);
      }
    }, 16);
    
    setInterval(() => { if (isAutoScrolling) window.updateClock(cells, container); }, 100);
  }, 600);
};

// SugarCube 로드 대기
jQuery(document).one(':storyready', function() { setTimeout(window.initTimeline, 100); });
jQuery(document).on(':passagedisplay', function() { setTimeout(window.initTimeline, 100); });

// SugarCube 로드 대기
jQuery(document).one(':storyready', function() { setTimeout(window.initTimeline, 100); });
jQuery(document).on(':passagedisplay', function() { setTimeout(window.initTimeline, 100); });