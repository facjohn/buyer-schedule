// 바이어 미정·산지 미정 꼬리표: 빨간 바탕 흰 글자 + 느낌표 + 깜빡이는 테두리(2026-10-30 사용자 요청: 긴급, 빨리 확정)
import { IconAlert } from './icons.jsx';

export default function TbdChip({ children }) {
  return (
    <span className="tbd-chip">
      <IconAlert size={13} />
      {children}
    </span>
  );
}
