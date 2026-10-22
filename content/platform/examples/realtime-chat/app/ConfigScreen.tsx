import type { ChatConfig } from './types';

interface ConfigScreenProps {
  config: ChatConfig;
  onSave: (config: ChatConfig) => void;
}

export default function ConfigScreen({ config, onSave }: ConfigScreenProps) {
  return (
    <div className="screen">
      <h1>🌋 Volcano Chat</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            apiUrl: form.get('apiUrl') as string,
            anonKey: form.get('anonKey') as string,
          });
        }}
      >
        <input name="apiUrl" className="input" defaultValue={config.apiUrl} placeholder="API URL" />
        <input name="anonKey" className="input" placeholder="Anon Key" required />
        <button className="button">Continue</button>
      </form>
    </div>
  );
}
