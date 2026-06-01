export function CarryOverBanner({ count }: { count: number }) {
  return (
    <div className="carry-over-banner">
      昨日有 {count} 项未完成，已保留在今日泳道中
    </div>
  );
}
