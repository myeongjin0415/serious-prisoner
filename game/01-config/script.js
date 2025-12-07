// setup 객체 정의
setup.timelineStartMinutes = 480;
setup.formatTime = function(hour, min) {
  return String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0');
};
setup.timeline = [
  {
    minutesFromStart: 0,
    scripts: [
      "[총성:1:0:(세면실)]과 함께 기상한다... 침대에서 벗어나 정해진 순서대로 움직인다.",
      "나는 누구였찌?"
    ]
  },
  {
    minutesFromStart: 15,
    scripts: [
      "문이 열린다. 간수의 이동 명령에 따라 (세면실:4->1)로 이동한다. 정해진 시간 내에 세면을 마쳐야 한다."
    ]
  },
  {
    minutesFromStart: 30,
    scripts: [
      "아침 식사 시간. 식당으로 이동하여 배식받은 식사를 먹는다. [대화:3 -> 1]는 금지되어 있다.",
      "아침 식사 시간. 식당으로 이동하여 배식받은 식사를 먹는다. 작은 속삭임이 오가지만, 간수의 눈치를 보며 조심스럽게 말을 섞는다.",
      "저녁 식사 시간"
    ]
  },
  {
    minutesFromStart: 45,
    scripts: [
      "식사 후 식기를 반납하고 복도로 이동한다. 각자의 작업장으로 향한다.",
      "저녁 식사 시간"
    ]
  },
    {
    minutesFromStart: 60,
    scripts: [
      "식사 후 식기를 반납하고 복도로 이동한다. 각자의 작업장으로 향한다.",
      "으아아아아아아아아!!!!!"
    ]
  }
];

// 전역 루프 카운터 (페이지 전체에서 누적)
window.__timelineLoopCount = window.__timelineLoopCount || 0;

// 시계 업데이트 함수 (최적화: 스크롤 위치 기반 계산)
window.updateClock = function(timelineCells, timelineContainer) {
  if (!timelineCells || timelineCells.length === 0 || !timelineContainer) return;
  
  const clockElement = document.getElementById('clock-time');
  if (!clockElement) return;
  
  // 스크롤 위치와 뷰포트 높이로 중앙 위치 계산
  const scrollTop = timelineContainer.scrollTop;
  const viewportHeight = timelineContainer.clientHeight;
  const viewportCenter = scrollTop + viewportHeight / 2;
  
  // 뷰포트 중앙에 가장 가까운 셀 찾기 (offsetTop 사용으로 성능 향상)
  let closestCell = null;
  let minDistance = Infinity;
  
  timelineCells.forEach(function(cell) {
    const cellTop = cell.offsetTop;
    const cellHeight = cell.offsetHeight;
    const cellCenter = cellTop + cellHeight / 2;
    
    // 셀이 뷰포트 중앙에 가장 가까운지 확인
    const distance = Math.abs(cellCenter - viewportCenter);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestCell = cell;
    }
  });
  
  if (closestCell) {
    const timeText = closestCell.querySelector('.cell-time');
    if (timeText) {
      const newTime = timeText.textContent.trim();
      // 값이 변경된 경우에만 업데이트 (불필요한 DOM 조작 방지)
      if (clockElement.textContent !== newTime) {
        clockElement.textContent = newTime;
      }
    }
  }
};

// 스크롤 이벤트 핸들러 (throttle 적용)
window.throttle = function(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    if (!timeout) {
      timeout = setTimeout(function() {
        timeout = null;
        func.apply(context, args);
      }, wait);
    }
  };
};

// 초기화 함수
window.initTimeline = function() {
  const timelineContainer = document.getElementById('timeline');
  const clockElement = document.getElementById('clock-time');
  const loopCountElement = document.getElementById('clock-loop-count');
  
  if (!timelineContainer || !clockElement) {
    setTimeout(window.initTimeline, 100);
    return;
  }
  
  // 모든 타임라인 셀 가져오기
  const timelineCells = Array.from(timelineContainer.querySelectorAll('.timeline-cell'));
  
  if (timelineCells.length === 0) {
    setTimeout(window.initTimeline, 100);
    return;
  }
  
  // 초기 시간 설정 (첫 번째 셀의 시간)
  const firstCell = timelineCells[0];
  const firstTime = firstCell.querySelector('.cell-time');
  if (firstTime) {
    clockElement.textContent = firstTime.textContent.trim();
  }
  
  // 루프 카운터 표시 초기화 (전역 값 사용)
  if (loopCountElement) {
    loopCountElement.textContent = '루프: ' + window.__timelineLoopCount;
  }

  // 텍스트 안의 다양한 액션 패턴을 파싱해 클릭 가능한 링크로 변환
  function setupTimelineActions() {
    // 1. 주체 패턴: [주체텍스트:타겟셀인덱스:타겟스크립트인덱스:(레이블)]
    const triggerRegex = /\[([^\[\]:]+):(\d+):(\d+):\(([^\)]+)\)\]/g;
    // 2. 활성화된 액션 패턴: [레이블:타겟셀인덱스 -> 타겟스크립트인덱스]
    const activeActionRegex = /\[([^\[\]:]+):(\d+)\s*->\s*(\d+)\]/g;
    // 3. 비활성화된 액션 패턴: (레이블:타겟셀인덱스 -> 타겟스크립트인덱스)
    const inactiveActionRegex = /\(([^\(\):]+):(\d+)\s*->\s*(\d+)\)/g;

    timelineCells.forEach(function(cell, cellIndex) {
      const textEl = cell.querySelector('.cell-text');
      if (!textEl) return;

      const rawText = textEl.textContent;
      if (!rawText) return;

      let replaced = rawText;

      // 1. 주체 패턴 처리 (먼저 처리하여 다른 패턴과 겹치지 않도록)
      replaced = replaced.replace(triggerRegex, function(_, triggerText, targetCellIndexStr, targetScriptIndexStr, label) {
        const targetCellIndex = parseInt(targetCellIndexStr, 10);
        const targetScriptIndex = parseInt(targetScriptIndexStr, 10);
        return '<span class="timeline-trigger" data-trigger-text="' +
          triggerText + '" data-target-cell-index="' + targetCellIndex +
          '" data-target-script-index="' + targetScriptIndex +
          '" data-label="' + label + '">' + triggerText + '</span>';
      });

      // 2. 활성화된 액션 패턴 처리
      replaced = replaced.replace(activeActionRegex, function(_, label, targetIndexStr, scriptIndexStr) {
        const targetIndex = parseInt(targetIndexStr, 10);
        const scriptIndex = parseInt(scriptIndexStr, 10);
        return '<span class="timeline-action timeline-action-active" data-target-index="' +
          targetIndex + '" data-script-index="' + scriptIndex + '">' +
          label + '</span>';
      });

      // 3. 비활성화된 액션 패턴 처리
      replaced = replaced.replace(inactiveActionRegex, function(_, label, targetIndexStr, scriptIndexStr) {
        const targetIndex = parseInt(targetIndexStr, 10);
        const scriptIndex = parseInt(scriptIndexStr, 10);
        return '<span class="timeline-action timeline-action-inactive" data-target-index="' +
          targetIndex + '" data-script-index="' + scriptIndex +
          '" data-label="' + label + '">' + label + '</span>';
      });

      if (replaced !== rawText) {
        textEl.innerHTML = replaced;
      }
    });

    // 이벤트 위임을 사용하여 중복 등록 방지
    // 기존 이벤트 리스너 제거 (중복 방지)
    if (timelineContainer._timelineActionHandler) {
      timelineContainer.removeEventListener('click', timelineContainer._timelineActionHandler);
    }
    
    // 주체 및 활성화된 액션 클릭 핸들러 (이벤트 위임)
    timelineContainer._timelineActionHandler = function(event) {
      const triggerEl = event.target.closest('.timeline-trigger');
      const actionEl = event.target.closest('.timeline-action-active');
      
      if (triggerEl) {
        // 주체 클릭 처리
        event.preventDefault();
        event.stopPropagation();

        const targetCellIndex = parseInt(triggerEl.getAttribute('data-target-cell-index'), 10);
        const targetScriptIndex = parseInt(triggerEl.getAttribute('data-target-script-index'), 10);
        const label = triggerEl.getAttribute('data-label');

        const targetCell = timelineCells[targetCellIndex];
        if (!targetCell) {
          console.warn('타겟 셀을 찾을 수 없습니다:', targetCellIndex);
          return;
        }

        const targetTextEl = targetCell.querySelector('.cell-text');
        if (!targetTextEl) return;

        // 해당 셀의 해당 스크립트에서 비활성화된 액션을 찾아 활성화
        const timeline = (typeof setup !== 'undefined' ? setup : (window.setup || {})).timeline || [];
        const targetItem = timeline[targetCellIndex];
        
        if (!targetItem || !Array.isArray(targetItem.scripts)) {
          console.warn('타겟 아이템을 찾을 수 없습니다:', targetCellIndex);
          return;
        }
        
        if (targetItem.scripts[targetScriptIndex] === undefined) {
          console.warn('지정된 스크립트를 찾을 수 없습니다:', targetCellIndex, targetScriptIndex);
          return;
        }

        const targetScript = targetItem.scripts[targetScriptIndex];
        // 비활성화된 액션 패턴을 활성화된 액션 패턴으로 교체
        const inactivePattern = new RegExp('\\(' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)\\s*->\\s*(\\d+)\\)', 'g');
        const activatedScript = targetScript.replace(inactivePattern, function(_, targetIndexStr, scriptIndexStr) {
          return '[' + label + ':' + targetIndexStr + ' -> ' + scriptIndexStr + ']';
        });

        // 스크립트가 변경된 경우 업데이트
        if (activatedScript !== targetScript) {
          targetItem.scripts[targetScriptIndex] = activatedScript;
          // DOM을 원본 텍스트로 업데이트하고 다시 파싱
          targetTextEl.textContent = activatedScript;
          // 모든 셀을 다시 파싱하여 클릭 가능하게 만들기
          setupTimelineActions();
        }
      } else if (actionEl) {
        // 활성화된 액션 클릭 처리
        event.preventDefault();
        event.stopPropagation();

        const targetIndex = parseInt(actionEl.getAttribute('data-target-index'), 10);
        const scriptIndex = parseInt(actionEl.getAttribute('data-script-index'), 10);

        const targetCell = timelineCells[targetIndex];
        if (!targetCell) {
          console.warn('타겟 셀을 찾을 수 없습니다:', targetIndex);
          return;
        }

        const targetTextEl = targetCell.querySelector('.cell-text');
        if (!targetTextEl) return;

        // SugarCube의 setup 객체 직접 참조 (window.setup과 동기화 보장)
        const timeline = (typeof setup !== 'undefined' ? setup : (window.setup || {})).timeline || [];
        const targetItem = timeline[targetIndex];
        
        if (!targetItem) {
          console.warn('타겟 아이템을 찾을 수 없습니다:', targetIndex, 'timeline length:', timeline.length);
          return;
        }
        
        if (!Array.isArray(targetItem.scripts)) {
          console.warn('타겟 아이템에 scripts 배열이 없습니다:', targetIndex, targetItem);
          return;
        }
        
        if (targetItem.scripts[scriptIndex] === undefined) {
          console.warn('지정된 스크립트를 찾을 수 없습니다:', targetIndex, scriptIndex, 'available scripts:', targetItem.scripts.length);
          return;
        }

        // 해당 셀 텍스트를 선택된 스크립트로 교체
        targetTextEl.textContent = targetItem.scripts[scriptIndex];
        // 다시 파싱하여 새로운 액션들이 클릭 가능하게 만들기
        setupTimelineActions();
      }
    };
    
    timelineContainer.addEventListener('click', timelineContainer._timelineActionHandler);
  }
  
  // 스크롤 이벤트 핸들러 (throttle로 성능 최적화)
  const handleScroll = window.throttle(function() {
    window.updateClock(timelineCells, timelineContainer);
  }, 100); // 100ms마다 업데이트 (성능 향상)
  
  // 자동 스크롤 애니메이션 플래그
  let isAutoScrolling = false;
  
  // 초기 스크롤 위치 계산 함수 (루프를 위해 재사용)
  function calculateInitialScrollPosition() {
    // 항상 0으로 시작
    return 0;
  }
  
  // 초기 설정: 첫 번째 셀이 화면 아래에서 나타나도록 스크롤 위치 계산
  // 레이아웃이 완전히 렌더링될 때까지 기다림
  setTimeout(function() {
    const initialScroll = calculateInitialScrollPosition();
    timelineContainer.scrollTop = initialScroll;
  }, 50);
  
  // 약간의 딜레이 후 위에서 아래로 계속 스크롤 시작
  setTimeout(function() {
    // 최대 스크롤 가능한 값 계산
    const maxScroll = timelineContainer.scrollHeight - timelineContainer.clientHeight;
    
    // 스크롤할 거리가 충분한지 확인
    if (maxScroll <= 0) {
      return;
    }
    
    isAutoScrolling = true;

    // 셀 텍스트 안의 액션 링크 설정
    setupTimelineActions();
    const scrollSpeed = 30; // 초당 3000픽셀 스크롤
    const scrollInterval = 16; // 16ms마다 스크롤 업데이트 (약 60fps)
    const clockUpdateInterval = 100; // 100ms마다 시계 업데이트
    
    // 스크롤 업데이트: setInterval 사용
    const scrollTimer = setInterval(function() {
      const currentScroll = timelineContainer.scrollTop;
      const currentMaxScroll = timelineContainer.scrollHeight - timelineContainer.clientHeight;

      // 스크롤 속도에 따라 위치 증가 (초당 픽셀을 ms당 픽셀로 변환)
      const newScroll = currentScroll + (scrollSpeed * scrollInterval / 1000);

      // 최대 스크롤 위치를 넘으면 루프 1회만 증가시키고 맨 위로 점프 (전역 카운터 사용)
      if (newScroll >= currentMaxScroll) {
        window.__timelineLoopCount++;
        if (loopCountElement) {
          loopCountElement.textContent = '루프: ' + window.__timelineLoopCount;
        }
        timelineContainer.scrollTop = 0;
        window.updateClock(timelineCells, timelineContainer);
        return;
      }

      // 정상 스크롤 진행
      timelineContainer.scrollTop = newScroll;
    }, scrollInterval);
    
    // 시계 업데이트: 별도의 setInterval 사용
    const clockTimer = setInterval(function() {
      if (isAutoScrolling) {
        window.updateClock(timelineCells, timelineContainer);
      }
    }, clockUpdateInterval);
  }, 600); // 600ms 딜레이
  
  // 스크롤 이벤트 리스너 추가
  timelineContainer.addEventListener('scroll', function() {
    if (isAutoScrolling) {
      // 자동 스크롤 중에는 애니메이션 루프에서 업데이트하므로 여기서는 업데이트하지 않음
      // (중복 호출 방지)
    } else {
      handleScroll();
    }
  });
  
  // 초기 업데이트
  window.updateClock(timelineCells, timelineContainer);
};

// SugarCube가 완전히 로드될 때까지 기다림
jQuery(document).one(':storyready', function() {
  setTimeout(window.initTimeline, 100);
});

// SugarCube 이벤트 리스너 등록
jQuery(document).on(':passagedisplay', function() {
  setTimeout(window.initTimeline, 100);
});

jQuery(document).on(':passageinit', function() {
  setTimeout(window.initTimeline, 100);
});