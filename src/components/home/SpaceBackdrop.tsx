// Космо-фон главной: картинка дня NASA (через /api/apod) очень тонким слоем.
// z-[1] — над матрицей (z-0), но под контентом (z-10). screen-blend + сильное
// затемнение/обесцвечивание + низкая непрозрачность → сквозь дождь проступают
// лишь редкие «звёзды», без резкого контраста. Тема-нейтрально (работает на
// всех темах). В видео-дни/при сбое /api/apod отдаёт 204 → слой пустой.
export default function SpaceBackdrop({ solo = false }: { solo?: boolean }) {
  // solo = режим «только космос» (без дождя): делаем ярче и цветнее — космос
  // теперь главный элемент. В комбо с дождём — приглушённый фон.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        backgroundImage: "url(/api/apod)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Тюнинг видимости: opacity — насколько заметно, brightness — яркость.
        filter: solo
          ? "grayscale(0.15) brightness(0.9) contrast(1.05)"
          : "grayscale(0.5) brightness(0.7) contrast(1.05)",
        opacity: solo ? 0.6 : 0.3,
      }}
    />
  );
}
