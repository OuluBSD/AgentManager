"use client";

type FileDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function FileDialog({ isOpen, onClose }: FileDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--panel)",
          padding: "2rem",
          borderRadius: "8px",
          width: "80%",
          maxWidth: "800px",
          height: "80%",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Attach File</h2>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div
          style={{
            flex: 1,
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
          }}
        >
          File browser will be implemented here in the future.
        </div>
      </div>
    </div>
  );
}
