// Космо-фон главной: картинка дня NASA (через /api/apod) очень тонким слоем.
// z-[1] — над матрицей (z-0), но под контентом (z-10). screen-blend + сильное
// затемнение/обесцвечивание + низкая непрозрачность → сквозь дождь проступают
// лишь редкие «звёзды», без резкого контраста. Тема-нейтрально (работает на
// всех темах). В видео-дни/при сбое /api/apod отдаёт 204 → слой пустой.
export default function SpaceBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        backgroundImage: "url(/api/apod)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Тюнинг видимости: opacity — насколько заметно (0.15 еле-еле … 0.45 явно),
        // brightness — насколько тёмный. Обычный blend поверх матрицы (не screen),
        // слой на 30% полупрозрачный → сквозь него видно дождь.
        filter: "grayscale(0.5) brightness(0.7) contrast(1.05)",
        opacity: 0.3,
      }}
    />
  );
}
