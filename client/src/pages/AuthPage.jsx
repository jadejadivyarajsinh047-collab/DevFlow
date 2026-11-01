import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Command,
  Eye,
  EyeOff,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function AuthPage({ mode = "login" }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await (isRegister
        ? register(form)
        : login({ email: form.email, password: form.password }));
      navigate("/app");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-brand">
          <div className="brand-mark">
            <Command size={19} />
          </div>
          devflow
        </div>
        <div className="visual-copy">
          <div className="eyebrow">
            <Sparkles size={14} /> YOUR WORK, IN FLOW
          </div>
          <h1>
            Make room for
            <br />
            <span>great work.</span>
          </h1>
          <p>
            One calm, connected space to plan projects, align your team, and
            make meaningful progress.
          </p>
          <div className="visual-points">
            <span>
              <CheckCircle2 size={16} /> Bring every project together
            </span>
            <span>
              <CheckCircle2 size={16} /> Keep your team in sync
            </span>
            <span>
              <CheckCircle2 size={16} /> Turn plans into progress
            </span>
          </div>
        </div>
        <div className="visual-bottom">
          <div className="mini-avatars">
            <i>JD</i>
            <i>AM</i>
            <i>SK</i>
            <i>+8</i>
          </div>
          <span>Loved by teams that get things done.</span>
        </div>
        <div className="visual-orb orb-one" />
        <div className="visual-orb orb-two" />
      </div>
      <div className="auth-form-side">
        <div className="auth-mobile-brand">
          <div className="brand-mark">
            <Command size={18} />
          </div>
          devflow
        </div>
        <div className="auth-form-wrap">
          <div className="auth-icon">
            <Layers3 size={22} />
          </div>
          <p className="auth-kicker">
            {isRegister ? "GET STARTED FOR FREE" : "WELCOME BACK"}
          </p>
          <h2>{isRegister ? "Create your account" : "Sign in to DevFlow"}</h2>
          <p className="auth-subtitle">
            {isRegister
              ? "Start building momentum with your team."
              : "Enter your details to pick up where you left off."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {isRegister && (
              <label>
                Full name
                <input
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="Alex Morgan"
                  required
                  minLength="2"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <div className="password-wrap">
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={change}
                  placeholder="At least 8 characters"
                  required
                  minLength="8"
                />
                <button type="button" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {!isRegister && (
              <div className="forgot-row">
                <span>Secure sign in</span>
                <span>
                  <ShieldCheck size={14} /> Protected session
                </span>
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
            <button className="primary-btn auth-submit" disabled={busy}>
              {busy
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-switch">
            {isRegister ? "Already have an account?" : "New to DevFlow?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </div>
          <p className="auth-terms">
            By continuing, you agree to our{" "}
            <a href="#terms">Terms of Service</a> and{" "}
            <a href="#privacy">Privacy Policy</a>.
          </p>
        </div>
        <div className="auth-footer">
          © 2026 DevFlow, Inc. <span>Built for better work.</span>
        </div>
      </div>
    </div>
  );
}
