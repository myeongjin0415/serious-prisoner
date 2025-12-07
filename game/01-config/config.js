// setup 객체 정의
setup.timelineStartMinutes = 480;
setup.timelineStartDate = { month: 12, day: 2 }; // [추가됨] 시작 날짜
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
  },
  {
    minutesFromStart: 1680,
    scripts: [
      "그 다음날입니다.",
      "으아아아아아아아아!!!!!"
    ]
  }
];