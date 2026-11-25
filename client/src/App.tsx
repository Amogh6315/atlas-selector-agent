import { useRef, useState } from "react";
import "./App.css";

function App() {
  const [image, setImage] = useState<File | null>(null);
  const [targetDescription, setTargetDescription] = useState("");
  const [preview, setPreview] = useState("");
  const [selectors, setSelectors] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleFile = (file: File) => {
    setError("");
    setSelectors([]);

    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Image size must be smaller than 10 MB.");
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    const imageUrl = URL.createObjectURL(file);

    setImage(file);
    setPreview(imageUrl);
  };

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLLabelElement>
  ) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLLabelElement>
  ) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLLabelElement>
  ) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleFile(file);
    }
  };

  const removeImage = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setImage(null);
    setPreview("");
    setSelectors([]);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const generateSelector = async () => {
    if (!image) {
      setError("Please upload a DOM screenshot first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSelectors([]);

      const reader = new FileReader();

      reader.onloadend = async () => {
        try {
          const base64 = reader.result?.toString().split(",")[1];

          if (!base64) {
            throw new Error("Could not process the image.");
          }

          const response = await fetch(
            "http://localhost:3001/api/selector",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                image: base64,
                targetDescription: targetDescription.trim(),
                feedback: [
                  feedback,
                  feedbackDetails.trim(),
                ]
                  .filter(Boolean)
                  .join(". "),
              }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to generate selector.");
          }

          const data = await response.json();

          setSelectors(data.selectors || []);
        } catch (err) {
          console.error(err);
          setError("Failed to generate selector.");
        } finally {
          setLoading(false);
        }
      };

      reader.readAsDataURL(image);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Something went wrong.");
    }
  };

  const copySelector = async (selector: string) => {
    await navigator.clipboard.writeText(selector);
  };

  return (
    <main className="app">
      <div className="background-glow" />

      <div className="container">

        {/* Header */}
        <header className="header">
          <div className="brand">
            <div className="brand-icon">A</div>
            <span>Atlas</span>
          </div>

          <h1>
            Find the right
            <span> CSS selector.</span>
          </h1>

          <p>
            Upload a DOM inspector screenshot and let Atlas
            generate a stable, meaningful selector.
          </p>
        </header>

        {/* Upload */}
        <section className="upload-section">
          <label
            className={`upload-box ${isDragging ? "dragging" : ""
              } ${preview ? "has-preview" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
            />

            {preview ? (
              <div className="preview-wrapper">
                <img
                  src={preview}
                  alt="DOM screenshot preview"
                />

                <div className="preview-overlay">
                  <span>
                    Click or drop another image
                  </span>
                </div>
              </div>
            ) : (
              <div className="upload-content">

                <div className="upload-icon">
                  ↑
                </div>

                <div className="upload-title">
                  Drop your DOM screenshot here
                </div>

                <div className="upload-description">
                  or click to browse · PNG, JPG, WebP · Max 10 MB
                </div>

              </div>
            )}
          </label>

          {image && (
            <div className="file-info">
              <div className="file-details">
                <span className="file-name">
                  {image.name}
                </span>

                <span className="file-size">
                  {(image.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>

              <button
                className="remove-button"
                onClick={removeImage}
                type="button"
              >
                Remove
              </button>
            </div>
          )}
        </section>

        {/* Target description */}
        <section className="target-section">
          <label htmlFor="target-description">
            Which element do you want?
          </label>

          <input
            id="target-description"
            type="text"
            value={targetDescription}
            onChange={(event) =>
              setTargetDescription(event.target.value)
            }
            placeholder="e.g. the search input, the Drafts button"
            maxLength={300}
          />

          <p>
            Describe the specific element shown in your DOM inspector screenshot.
          </p>
        </section>

        {/* Generate */}
        <button

          className="generate-button"
          onClick={generateSelector}
          disabled={!image || loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Analyzing DOM...
            </>
          ) : (
            <>
              Generate selector
              <span>→</span>
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="error">
            {error}
          </div>
        )}



        {/* Results */}
        {selectors.length > 0 && (
          <section className="results">
            <div className="results-header">
              <div>
                <span className="result-label">RESULT</span>
                <h2>Generated selector</h2>
              </div>

              <span className="result-count">
                {selectors.length}
              </span>
            </div>

            {selectors.map((selector, index) => (
              <div
                className={`selector-card ${index === 0 ? "best" : ""
                  }`}
                key={`${selector}-${index}`}
              >
                <div className="selector-info">
                  {index === 0 && (
                    <span className="best-label">
                      BEST MATCH
                    </span>
                  )}

                  <code>{selector}</code>
                </div>

                <button
                  className="copy-button"
                  type="button"
                  onClick={() => copySelector(selector)}
                >
                  Copy
                </button>
              </div>
            ))}

<div className="feedback-section">
  <label htmlFor="selector-feedback">
    What should be improved?
  </label>

  <select
    id="selector-feedback"
    value={feedback}
    onChange={(event) => setFeedback(event.target.value)}
  >
    <option value="">Select feedback (optional)</option>
    <option value="The wrong element was selected">
      Wrong element
    </option>
    <option value="The selector matches multiple elements">
      Selector matches multiple elements
    </option>
    <option value="Avoid dynamic or generated classes">
      Avoid dynamic classes
    </option>
    <option value="Prefer a simpler, more meaningful selector">
      Prefer a simpler selector
    </option>
    <option value="Generate different selector alternatives">
      Try different alternatives
    </option>
  </select>

  <textarea
    value={feedbackDetails}
    onChange={(event) => setFeedbackDetails(event.target.value)}
    placeholder="Optional: describe exactly what should change..."
    rows={2}
    maxLength={500}
  />
</div>

            <button
              className="regenerate-button"
              type="button"
              onClick={generateSelector}
              disabled={loading || !image}
            >
              {loading ? "Regenerating..." : "↻ Regenerate response"}
            </button>
          </section>
        )}


        <footer>
          Atlas · Stable selectors, without the guesswork.
        </footer>
      </div>
    </main>
  );
}

export default App;