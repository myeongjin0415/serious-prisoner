// setup 객체 정의
/* 1. 설정 및 헬퍼 함수 */
setup.timelineStartConf = { month: 12, day: 2, hour: 8, min: 0 }; // 시작 기준점

setup.formatTime = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
setup.pad = (n) => String(n).padStart(2, '0');

/* 2. 타임라인 데이터 입력 (순서 섞여도 OK, 시간만 정확히 입력하세요) */
setup.rawTimeline = [
  {
    month: 12, day: 2, hour: 8, min: 0,
    scripts: [
      "[총성:12-02-08-15:0:(세면실) #CLUE_A]과 함께 기상한다... 침대에서 벗어나...",
      "나는 누구였지?"
    ]
  },
  {
    month: 12, day: 2, hour: 8, min: 15,
    scripts: [
      "문이 열린다. (세면실:12-02-08-30 -> 1 #CLUE_B)로 이동한다."
    ]
  },
  {
    month: 12, day: 2, hour: 8, min: 30,
    scripts: [
      "아침 식사 시간. [대화:12-02-18-00 -> 1 #CLUE_C]는 금지되어 있다.", 
      "작은 속삭임이 오가지만..."
    ]
  },
  {
    month: 12, day: 2, hour: 18, min: 0,
    scripts: [
      "저녁 식사 시간. 평소와 다름 없다.",  // index 0 (기본)
      "저녁 식사 시간. 어라? 메뉴가 바뀌었다.", // index 1 (루프 1회차 이상)
      "저녁 식사 시간. 이제 이 맛도 지겹다."   // index 2 (루프 3회차 이상)
    ],
    // ★ 루프 트리거 추가
    loopTriggers: [
      { loop: 1, index: 1 }, // 루프 카운트가 1 이상이면 index 1 사용
      { loop: 3, index: 2 }  // 루프 카운트가 3 이상이면 index 2 사용
    ]
  },
  {
    // 순서가 뒤섞여 있어도 상관없음 (예: 다음날 데이터)
    month: 12, day: 3, hour: 12, min: 0,
    scripts: [
      "다음날 점심시간입니다. 루프가 되었나요?",
      "반복되는 하루..."
    ]
  },
  {
    month: 12, day: 3, hour: 12, min: 30,
    scripts: [
      "배드 엔딩",
      "트루 엔딩!",
    ],
    conditionTriggers: [
      {
        // 이 3가지 플래그가 모두 window.__timelineFlags에 있어야 함
        // required: ['CLUE_A', 'CLUE_B'], 
        // required: ['CLUE_C'], 
        required: ['CLUE_A','CLUE_B','CLUE_C'], 
        index: 1 // 조건을 만족하면 scripts[1]을 보여줌
      }
    ]
  }
];

/* 3. 데이터 전처리 (자동 정렬 및 ID 생성) */
setup.processTimeline = function() {
  const startObj = setup.timelineStartConf;
  // 기준 시간 (연도는 임의로 2024 설정)
  const startDate = new Date(2024, startObj.month - 1, startObj.day, startObj.hour, startObj.min);

  // 데이터 가공
  setup.timeline = setup.rawTimeline.map(item => {
    // 해당 아이템의 시간 객체
    const itemDate = new Date(2024, item.month - 1, item.day, item.hour, item.min);
    
    // 시작 시간과의 차이(분) 계산 -> 시계 로직용
    const diffMs = itemDate - startDate;
    // 00:00 기준 절대 분 계산 (시계 표시에 사용)
    const totalMinutes = Math.floor(diffMs / 1000 / 60) + (startObj.hour * 60) + startObj.min;
    
    // 고유 ID 생성 (Format: MM-DD-HH-mm) -> 링크용
    const timeId = `${setup.pad(item.month)}-${setup.pad(item.day)}-${setup.pad(item.hour)}-${setup.pad(item.min)}`;
    
    // 날짜 텍스트 (예: 12월 2일)
    const dateText = `${item.month}월 ${item.day}일`;

    return {
      ...item,
      totalMinutes: totalMinutes, // 시계 계산용
      timeId: timeId,             // 링크 연결용 ID
      dateText: dateText,         // 날짜 표시용
      sortTime: itemDate.getTime() // 정렬용 타임스탬프
    };
  });

  // 시간순 정렬
  setup.timeline.sort((a, b) => a.sortTime - b.sortTime);
};

// 실행
setup.processTimeline();