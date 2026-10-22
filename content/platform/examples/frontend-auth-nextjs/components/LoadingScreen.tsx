interface LoadingScreenProps {
  text: string;
}

// Full-page spinner shown while the SDK or the page's data loads
export default function LoadingScreen({ text }: LoadingScreenProps) {
  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <div className="loading" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '20px', color: '#666' }}>{text}</p>
      </div>
    </div>
  );
}
