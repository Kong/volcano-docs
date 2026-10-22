interface JoinScreenProps {
  error: string;
  name: string;
  onNameChange: (name: string) => void;
  onJoin: (name: string) => void;
  onChangeConfig: () => void;
}

export default function JoinScreen({ error, name, onNameChange, onJoin, onChangeConfig }: JoinScreenProps) {
  return (
    <div className="screen">
      <h1>🌋 Volcano Chat</h1>
      {error && <div className="alert error">{error}</div>}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(name);
        }}
      >
        <input
          name="name"
          className="input"
          placeholder="Your name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
        <button className="button">Join</button>
        <button type="button" className="button secondary" onClick={onChangeConfig}>
          Change Config
        </button>
      </form>
    </div>
  );
}
