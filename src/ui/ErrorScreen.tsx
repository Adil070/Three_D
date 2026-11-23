export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="error-screen" role="alert">
      <div className="error-screen__card">
        <h1>This property couldn’t be opened</h1>
        <pre>{message}</pre>
        <p>
          Check the link, or open <a href="#demo-project">the demo project</a>.
        </p>
      </div>
    </div>
  );
}
