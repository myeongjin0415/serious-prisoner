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

    cells.forEach(cell => {
      // 1. 해당 셀의 데이터 원본 찾기
      const timeId = cell.getAttribute('data-time-id'); // Start 패시지에서 넣어둔 ID
      const dataItem = setup.timeline.find(item => item.timeId === timeId);
      
      if (!dataItem || !dataItem.loopTriggers) return;

      // 2. 조건에 맞는 스크립트 인덱스 찾기
      let targetIndex = 0; // 기본값
      
      // loopTriggers 배열을 순회하며 조건 확인 (오름차순 정렬 가정하거나 끝까지 확인)
      dataItem.loopTriggers.forEach(trigger => {
        if (currentLoop >= trigger.loop) {
          targetIndex = trigger.index;
        }
      });

      // 3. 현재 내용과 다르면 업데이트
      // 주의: 이미 링크를 눌러서 바뀐 내용은 초기화됩니다. (루프니까 초기화되는게 맞음)
      const newText = dataItem.scripts[targetIndex];
      const textEl = cell.querySelector('.cell-text');
      
      // 현재 텍스트가 단순히 태그가 포함된 상태일 수 있으므로 텍스트 내용만 비교하긴 어려움
      // 따라서 루프가 바뀔 때마다 무조건 갱신하거나, 플래그를 두는 방식 사용
      // 여기서는 data-current-loop-idx 속성을 심어서 비교합니다.
      const currentRenderedIdx = parseInt(cell.getAttribute('data-current-script-idx') || 0);

      if (currentRenderedIdx !== targetIndex) {
         textEl.textContent = newText;
         cell.setAttribute('data-current-script-idx', targetIndex);
         // console.log(`[Loop Update] ${timeId} updated to index ${targetIndex}`);
      }
    });

    // 4. 텍스트가 바뀌었으니 액션 링크(이벤트) 다시 연결
    setupActions();
  }

  /* 액션 파싱 로직 (기존 코드 유지) */
  function setupActions() {
    const timeIdPattern = "\\d{2}-\\d{2}-\\d{2}-\\d{2}";
    const triggerRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern}):(\\d+):\\(([^\\)]+)\\)\\]`, 'g');
    const activeRegex = new RegExp(`\\[([^\\[\\]:]+):(${timeIdPattern})\\s*->\\s*(\\d+)\\]`, 'g');
    const inactiveRegex = new RegExp(`\\(([^\\(\\):]+):(${timeIdPattern})\\s*->\\s*(\\d+)\\)`, 'g');

    cells.forEach(cell => {
      const textEl = cell.querySelector('.cell-text');
      if (!textEl) return;
      let html = textEl.textContent;

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

    container.onclick = function(e) {
      const trigger = e.target.closest('.timeline-trigger');
      const action = e.target.closest('.timeline-action.active');
      const target = trigger || action;

      if (!target) return;
      e.preventDefault(); e.stopPropagation();

      const targetId = target.getAttribute('data-target-id');
      const scriptIdx = parseInt(target.getAttribute('data-script-idx'), 10);
      
      const targetCell = container.querySelector(`.timeline-cell[data-time-id="${targetId}"]`);
      if (!targetCell) return;

      const dataItem = setup.timeline.find(item => item.timeId === targetId);
      if (!dataItem || !dataItem.scripts[scriptIdx]) return;

      if (trigger) {
        const label = target.getAttribute('data-label');
        const targetScript = dataItem.scripts[scriptIdx];
        const pattern = new RegExp(`\\(${label}:(${timeIdPattern})\\s*->\\s*(\\d+)\\)`);
        
        const newScript = targetScript.replace(pattern, function(_, nextTimeId, nextScriptIdx) {
            return `[${label}:${nextTimeId} -> ${nextScriptIdx}]`;
        });
        
        if (newScript !== targetScript) {
          dataItem.scripts[scriptIdx] = newScript;
          targetCell.querySelector('.cell-text').textContent = newScript;
          setupActions();
        }
      } else {
        targetCell.querySelector('.cell-text').textContent = dataItem.scripts[scriptIdx];
        setupActions();
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