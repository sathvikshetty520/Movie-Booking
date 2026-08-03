export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <strong>{t.title}</strong>
          {t.message && <div className="toast-msg">{t.message}</div>}
        </div>
      ))}
    </div>
  );
}