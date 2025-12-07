// 전역 루프 카운터
window.__timelineLoopCount = window.__timelineLoopCount || 0;

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
window.initTimeline = function() {
  const container = document.getElementById('timeline');
  if (!container) { setTimeout(window.initTimeline, 100); return; }
  
  const cells = Array.from(container.querySelectorAll('.timeline-cell'));
  if (!cells.length) { setTimeout(window.initTimeline, 100); return; }

  // 초기 시계 업데이트
  window.updateClock(cells, container);
  
  const loopEl = document.getElementById('clock-loop-count');
  if (loopEl) loopEl.textContent = '루프: ' + window.__timelineLoopCount;

  /* ★ 액션 파싱 로직 (ID 기반으로 변경) ★ */
/* ★ 액션 파싱 로직 (ID 기반으로 변경) ★ */
function setupActions() {
  // 시간 ID 패턴: 숫자2자리-숫자2자리-숫자2자리-숫자2자리 (예: 12-02-08-30)
  const timeIdPattern = "\\d{2}-\\d{2}-\\d{2}-\\d{2}";

  // 1. Trigger: [텍스트:TimeID:ScriptIdx:(라벨)]
  const triggerRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern}):(\\d+):\\(([^\\)]+)\\)\\]`, 'g');
  
  // 2. Active: [라벨:TimeID -> ScriptIdx]
  const activeRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern})\\s*->\\s*(\\d+)\\]`, 'g');
  
  // 3. Inactive: (라벨:TimeID -> ScriptIdx)
  const inactiveRegex = new RegExp(`\\(([^\\(\\):]+):(${timeIdPattern})\\s*->\\s*(\\d+)\\)`, 'g');

  cells.forEach(cell => {
    const textEl = cell.querySelector('.cell-text');
    if (!textEl) return;
    let html = textEl.textContent;

    // HTML 변환
    html = html.replace(triggerRegex, (_, txt, timeId, sIdx, lbl) => 
      `<span class="timeline-trigger" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${lbl}">${txt}</span>`
    );
    html = html.replace(activeRegex, (_, lbl, timeId, sIdx) => 
      `<span class="timeline-action active" data-target-id="${timeId}" data-script-idx="${sIdx}">${lbl}</span>`
    );
    html = html.replace(inactiveRegex, (_, lbl, timeId, sIdx) => 
      `<span class="timeline-action inactive" data-target-id="${timeId}" data-script-idx="${sIdx}" data-label="${lbl}">${lbl}</span>`
    );

    if (html !== textEl.textContent) textEl.innerHTML = html;
  });

  // 클릭 이벤트 핸들러
  container.onclick = function(e) {
    const trigger = e.target.closest('.timeline-trigger');
    const action = e.target.closest('.timeline-action.active');
    const target = trigger || action;

    if (!target) return;
    e.preventDefault(); e.stopPropagation();

    const targetId = target.getAttribute('data-target-id'); // 이동할 타겟 셀 ID
    const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
    
    // 1. 타겟 셀 찾기
    const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
    if (!targetCell) {
      console.warn('Target cell not found for ID:', targetId);
      return;
    }

    // 2. 데이터 원본 찾기
    const dataItem = setup.timeline.find(item => item.timeId === targetId);
    if (!dataItem || !dataItem.scripts[scriptIdx]) {
      console.warn('Script not found:', targetId, scriptIdx);
      return;
    }

    // 3. 스크립트 교체
    if (trigger) {
      const label = target.getAttribute('data-label');
      const targetScript = dataItem.scripts[scriptIdx];
      
      // [수정된 부분] 
      // 기존: targetId를 사용하여 찾음 -> 실패 (안에 적힌 건 그 다음 단계 ID이므로)
      // 변경: timeIdPattern을 사용하여 "괄호 안에 있는 어떤 시간 ID든" 찾음
      const pattern = new RegExp(`\\(${label}:(${timeIdPattern})\\s*->\\s*(\\d+)\\)`);
      
      const newScript = targetScript.replace(pattern, function(_, nextTimeId, nextScriptIdx) {
          // 찾은 ID(nextTimeId)를 그대로 유지하면서 대괄호[]로 감싸 활성화
          return `[${label}:${nextTimeId} -> ${nextScriptIdx}]`;
      });
      
      if (newScript !== targetScript) {
        dataItem.scripts[scriptIdx] = newScript;
        targetCell.querySelector('.cell-text').textContent = newScript;
        setupActions(); // 재파싱
      }
    } else {
      // 단순 텍스트 교체 (Active Action 클릭 시)
      targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
      setupActions();
    }
  };
}
  
  // 최초 실행
  setupActions();

  // 스크롤 및 자동 재생
  const handleScroll = window.throttle(() => window.updateClock(cells, container), 100);
  container.addEventListener('scroll', handleScroll);

  let isAutoScrolling = false;
  setTimeout(() => {
    // 자동 스크롤 기능 (필요시 true로 변경)
    isAutoScrolling = true; 
    const speed = 30; 
    
    // 스크롤 루프
    setInterval(() => {
      if (!isAutoScrolling) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
        window.__timelineLoopCount++;
        const loopEl = document.getElementById('clock-loop-count');
        if(loopEl) loopEl.textContent = '루프: ' + window.__timelineLoopCount;
        container.scrollTop = 0;
        window.updateClock(cells, container);
      } else {
        container.scrollTop += (speed * 16 / 1000);
      }
    }, 16);
    
    // 시계 업데이트 루프
    setInterval(() => { if (isAutoScrolling) window.updateClock(cells, container); }, 100);
  }, 600);
};

// SugarCube 로드 대기
jQuery(document).one(':storyready', function() { setTimeout(window.initTimeline, 100); });
jQuery(document).on(':passagedisplay', function() { setTimeout(window.initTimeline, 100); });