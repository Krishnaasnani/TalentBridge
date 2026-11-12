import "../../styles/Categories.css";

export default function Categories() {
  return (
    <section className="categories">
      <h2>Browse Jobs by Category</h2>

      <div className="categories-grid">
        <div className="category-card">
          <h3>Frontend Development</h3>
          <p>1200+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>Backend Development</h3>
          <p>950+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>Full Stack</h3>
          <p>780+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>AI / ML</h3>
          <p>640+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>Data Science</h3>
          <p>520+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>DevOps</h3>
          <p>430+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>UI / UX</h3>
          <p>390+ Jobs</p>
        </div>

        <div className="category-card">
          <h3>Cyber Security</h3>
          <p>310+ Jobs</p>
        </div>
      </div>
    </section>
  );
}
