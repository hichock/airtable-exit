export default function NotFound() {
  return (
    <div className="content">
      <div className="panel empty-state">
        <p><strong>Not found.</strong> This record or page does not exist, or you don't have access to it.</p>
        <a className="btn btn-sm" href="/">Go to the dashboard</a>
      </div>
    </div>
  );
}
