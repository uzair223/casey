export const ProgressRail: React.FC<{ active: number }> = ({ active }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 14,
        zIndex: 2,
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          style={{
            width: index === active ? 18 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              index === active
                ? "#7357FF"
                : index < active
                  ? "rgba(115, 87, 255, 0.45)"
                  : "rgba(244, 245, 251, 0.16)",
          }}
        />
      ))}
    </div>
  );
};
