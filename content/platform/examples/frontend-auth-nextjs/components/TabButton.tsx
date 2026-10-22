interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

// One tab of a two-tab toggle, highlighted while active
export default function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? '#667eea' : 'transparent',
        color: active ? 'white' : '#666',
        borderRadius: '0',
        borderBottom: active ? '3px solid #667eea' : 'none',
        marginBottom: '-2px',
      }}
    >
      {children}
    </button>
  );
}
