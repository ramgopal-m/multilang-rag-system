"use client"

import { useEffect } from "react"

export default function HomePage() {
  useEffect(() => {
    // Redirect to the working translation interface
    window.location.href = "/translation-test.html"
  }, [])

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        textAlign: "center",
        padding: "40px",
        background: "rgba(255,255,255,0.1)",
        borderRadius: "15px",
        backdropFilter: "blur(10px)"
      }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "20px" }}>
          🌐 Multilingual RAG System
        </h1>
        <p style={{ fontSize: "1.2rem", marginBottom: "30px", opacity: 0.9 }}>
          Redirecting to Translation Interface...
        </p>
        <div style={{
          width: "50px",
          height: "50px",
          border: "4px solid rgba(255,255,255,0.3)",
          borderTop: "4px solid white",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto"
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: "20px", fontSize: "0.9rem", opacity: 0.7 }}>
          If not redirected automatically, <a href="/translation-test.html" style={{ color: "white", textDecoration: "underline" }}>click here</a>
        </p>
      </div>
    </div>
  )
}
