import { sansFont } from "../fonts";

export const ProductFrame: React.FC<{
  title: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
}> = ({ title, children, width = 900, height = 900 }) => {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 16,
        border: "1px solid rgba(243, 239, 230, 0.1)",
        backgroundColor: "#12110f",
        boxShadow: "0 40px 80px -40px rgba(0, 0, 0, 0.8)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid rgba(243, 239, 230, 0.1)",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "rgba(243, 239, 230, 0.2)",
          }}
        />
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "rgba(243, 239, 230, 0.2)",
          }}
        />
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "rgba(243, 239, 230, 0.2)",
          }}
        />
        <div
          style={{
            flex: 1,
            textAlign: "center",
            color: "rgba(243, 239, 230, 0.38)",
            fontFamily: sansFont,
            fontSize: 16,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#12110f",
        }}
      >
        {children}
      </div>
    </div>
  );
};
