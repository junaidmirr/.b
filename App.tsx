import { useEffect, useRef, useState, type FormEvent } from "react";
import { TurnstileCaptcha } from "./components/TurnstileCaptcha";
import { projects } from "./projectsData";
import type { Theme, IconName, Project, Skill } from "./types";

const skills: Skill[] = [
  {
    title: "Frontend",
    icon: "layout",
    items: [
      { label: "React", icon: "bxl-react" },
      { label: "TypeScript", icon: "bxl-typescript" },
      { label: "Tailwind CSS", icon: "bx-wind" },
      { label: "Responsive UI", icon: "bx-devices" },
    ],
  },
  {
    title: "Backend",
    icon: "server",
    items: [
      { label: "Node.js", icon: "bxl-nodejs" },
      { label: "REST APIs", icon: "bx-link-alt" },
      { label: "Authentication", icon: "bx-lock-alt" },
      { label: "Performance", icon: "bx-tachometer" },
    ],
  },
  {
    title: "Database",
    icon: "database",
    items: [
      { label: "MongoDB", icon: "bxl-mongodb" },
      { label: "PostgreSQL", icon: "bx-data" },
      { label: "Schema Design", icon: "bx-sitemap" },
      { label: "Query Optimization", icon: "bx-search-alt-2" },
    ],
  },
  {
    title: "Android Development",
    icon: "layout",
    items: [
      { label: "Android", icon: "bxl-android" },
      { label: "Kotlin", icon: "bx-code-block" },
      { label: "Firebase", icon: "bx-cloud-lightning" },
      { label: "Bootstrap", icon: "bxl-bootstrap" },
    ],
  },
];

// Projects are now imported from projectsData.ts

const highlights = [
  { label: "Projects Delivered", value: "12+", icon: "briefcase" as IconName },
  { label: "Core Skills", value: "10+", icon: "spark" as IconName },
  { label: "Years Learning", value: "3+", icon: "rocket" as IconName },
];

const contactItems = [
  {
    label: "Email",
    value: "junaidmeer055@gmail.com",
    icon: "mail" as IconName,
  },
  { label: "Location", value: "Bangalore, India", icon: "globe" as IconName },
  {
    label: "Work",
    value: "Currently taking on new clients",
    icon: "check" as IconName,
  },
];

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/junaidmirr",
    icon: "bxl-github",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/junaidmeer055/",
    icon: "bxl-linkedin-square",
  },
];

const navItems = ["About", "Skills", "Projects", "Contact"];

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProjectsHint, setShowProjectsHint] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [activeProjectTitle, setActiveProjectTitle] = useState<string | null>(
    null,
  );
  const projectsScrollerRef = useRef<HTMLDivElement | null>(null);
  const projectsSectionRef = useRef<HTMLElement | null>(null);
  const hasShownProjectsHintRef = useRef(false);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.style.overflow = contactModalOpen ? "hidden" : "";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContactModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [contactModalOpen]);

  useEffect(() => {
    const section = projectsSectionRef.current;
    if (!section || hasShownProjectsHintRef.current) {
      return;
    }

    let hideTimer: number | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasShownProjectsHintRef.current) {
          return;
        }

        hasShownProjectsHintRef.current = true;
        setShowProjectsHint(true);
        hideTimer = window.setTimeout(() => {
          setShowProjectsHint(false);
        }, 2600);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  const scrollProjects = (direction: "left" | "right") => {
    const container = projectsScrollerRef.current;
    if (!container) {
      return;
    }

    const scrollAmount = container.clientWidth * 0.85;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError("Enter a valid email address like name@example.com.");
      return;
    }

    if (!captchaToken) {
      setCaptchaError(
        "Complete the captcha challenge before sending your message.",
      );
      return;
    }

    setCaptchaError("");
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          email,
          message: formData.get("message"),
          captchaToken,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send your message.");
      }

      setMessageSent(true);
      window.setTimeout(() => {
        setContactModalOpen(false);
        setCaptchaToken("");
        setMessageSent(false);
        setSubmitError("");
        form.reset();
      }, 1400);
    } catch (error) {
      setCaptchaToken("");
      setSubmitError(
        error instanceof Error ? error.message : "Failed to send your message.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeProject = projects.find((p) => p.title === activeProjectTitle);

  if (activeProject) {
    return (
      <ProjectDetailView
        project={activeProject}
        onBack={() => setActiveProjectTitle(null)}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      <button
        type="button"
        onClick={() => setContactModalOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition hover:translate-y-[-1px] hover:brightness-105"
        aria-label="Open contact form"
      >
        <Icon name="mail" className="h-4 w-4" />
        Contact
      </button>

      {contactModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-muted)] uppercase">
                  Get In Touch
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Send a quick message
                </h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Fill in your details and complete the captcha challenge before
                  sending.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
                aria-label="Close contact form"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <form
              className="space-y-4"
              noValidate
              onSubmit={handleContactSubmit}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-[var(--color-muted)]">
                    Name
                  </span>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-[var(--color-muted)]">
                    Email
                  </span>
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    name="email"
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-[var(--color-muted)]">
                  Message
                </span>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell me about your project or idea."
                  className="w-full resize-none rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                />
              </label>

              {turnstileSiteKey ? (
                <TurnstileCaptcha
                  open={contactModalOpen}
                  siteKey={turnstileSiteKey}
                  theme={theme}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError("");
                  }}
                  onExpire={() => {
                    setCaptchaToken("");
                  }}
                />
              ) : (
                <div className="rounded-[1.5rem] border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                  Set <code>VITE_TURNSTILE_SITE_KEY</code> to enable the real
                  captcha widget.
                </div>
              )}

              {captchaError ? (
                <p className="text-sm text-red-500">{captchaError}</p>
              ) : null}
              {submitError ? (
                <p className="text-sm text-red-500">{submitError}</p>
              ) : null}

              <button
                type="submit"
                disabled={!captchaToken || isSubmitting || messageSent}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="mail" className="h-4 w-4" />
                {messageSent
                  ? "Message Sent"
                  : isSubmitting
                    ? "Sending..."
                    : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-12">
        <header className="sticky top-4 z-20 mb-10 rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <a href="#home" className="flex items-center gap-3">
              <span className="flex h-10 w-10 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] sm:h-11 sm:w-11">
                <img
                  src="https://avatars.githubusercontent.com/u/89933278?v=4"
                  alt="Junaid profile"
                  className="h-full w-full object-cover"
                />
              </span>
              <div>
                <p className="font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase">
                  Junaid
                </p>
                <p className="text-sm text-[var(--color-text)]">Portfolio</p>
              </div>
            </a>

            <div className="flex items-center gap-2 sm:gap-3">
              <nav className="hidden items-center gap-2 rounded-full bg-[var(--color-panel)] px-2 py-2 md:flex">
                {navItems.map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="rounded-full px-4 py-2 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  >
                    {item}
                  </a>
                ))}
              </nav>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:bg-[var(--color-surface)] md:hidden"
                aria-label={
                  mobileMenuOpen
                    ? "Close navigation menu"
                    : "Open navigation menu"
                }
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
              >
                <Icon
                  name={mobileMenuOpen ? "close" : "menu"}
                  className="h-5 w-5"
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setTheme((current) =>
                    current === "light" ? "dark" : "light",
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:scale-[1.03] hover:bg-[var(--color-surface)]"
                aria-label="Toggle dark mode"
              >
                <Icon
                  name={theme === "light" ? "moon" : "sun"}
                  className="h-5 w-5"
                />
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav
              id="mobile-navigation"
              className="mt-4 grid gap-2 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-3 md:hidden"
            >
              {navItems.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                >
                  <span>{item}</span>
                  <Icon name="arrow" className="h-4 w-4" />
                </a>
              ))}
            </nav>
          )}
        </header>

        <section
          id="home"
          className="grid items-center gap-8 rounded-[2rem] border border-[var(--color-border)] bg-[radial-gradient(circle_at_top_left,var(--color-spot),transparent_42%),var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10"
        >
          <div>
            <p className="mb-3 text-sm font-medium tracking-[0.2em] text-[var(--color-muted)] uppercase">
              Hello,
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              I'm Junaid. A developer who specializes in building clean, and practical digital products.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              My focus is on creating technology experiences that are fast, reliable, and user-centric.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#projects"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white transition hover:translate-y-[-1px]"
              >
                <Icon name="briefcase" className="h-4 w-4" />
                Explore Projects
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          

            {highlights.map((item, index) => (
              <div
                key={item.label}
                className={`rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-5 xl:col-span-2 ${
                  index === highlights.length - 1
                    ? "col-span-2 sm:col-span-1"
                    : "col-span-1"
                }`}
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-accent)]">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <p className="text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="about"
          className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <SectionCard
            eyebrow="About"
            title="What I do?"
            icon="user"
            description="I build simple, intuitive interfaces for complex products balancing visual clarity with clean, maintainable code and seamless cross device performance."
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <InfoCard
              title="What I focus on"
              icon="code"
              items={[
                "Accessible UI systems",
                "Reusable components",
                "Fast-loading pages",
                "Production-ready polish",
              ]}
            />
            <InfoCard
              title="How I work"
              icon="spark"
              items={[
                "Clear communication",
                "Attention to detail",
                "Pragmatic problem solving",
                "Iterative delivery",
              ]}
            />
          </div>
        </section>

        <section id="skills" className="mt-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Icon name="spark" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-muted)] uppercase">
                Skills
              </p>
              <h2 className="text-2xl font-semibold">
                Core tools and strengths
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {skills.map((skill) => (
              <article
                key={skill.title}
                className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5 xl:rounded-[1.75rem] xl:p-6"
              >
                <div className="mb-4 flex items-center justify-between gap-3 xl:mb-5">
                  <div>
                    <p className="text-sm text-[var(--color-muted)]">
                      Skill Area
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-snug sm:text-lg xl:text-xl">
                      {skill.title}
                    </h3>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-panel)] text-[var(--color-accent)] xl:h-12 xl:w-12">
                    <Icon name={skill.icon} className="h-4 w-4 xl:h-5 xl:w-5" />
                  </span>
                </div>

                <ul className="space-y-2.5 xl:space-y-3">
                  {skill.items.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2.5 text-xs text-[var(--color-muted)] sm:text-sm"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] xl:h-8 xl:w-8">
                        <BoxIcon
                          name={item.icon}
                          className="text-sm leading-none xl:text-base"
                        />
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          id="projects"
          ref={projectsSectionRef}
          className="relative mt-8"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Icon name="briefcase" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-muted)] uppercase">
                  Projects
                </p>
                <h2 className="text-2xl font-semibold">Selected work</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Swipe or use the arrows to browse more projects.
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => scrollProjects("left")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
                aria-label="Scroll projects left"
              >
                <Icon name="arrow" className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => scrollProjects("right")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
                aria-label="Scroll projects right"
              >
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className={`pointer-events-none absolute right-2 top-18 z-10 transition-all duration-500 sm:right-4 ${
              showProjectsHint
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0"
            }`}
          >
            <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold tracking-[0.14em] text-white shadow-[var(--shadow-soft)] uppercase">
              Swipe to see more
            </div>
          </div>

          <div
            ref={projectsScrollerRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 pr-2 [scrollbar-width:none]"
          >
            {projects.map((project) => (
              <article
                key={project.title}
                className="flex min-h-[320px] w-[85vw] shrink-0 snap-start flex-col rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:w-[26rem] lg:w-[28rem]"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-[var(--color-muted)]">
                      {project.category}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">
                      {project.title}
                    </h3>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-panel)] text-[var(--color-accent)]">
                    <Icon name={project.icon} className="h-5 w-5" />
                  </span>
                </div>

                <p className="text-sm leading-6 text-[var(--color-muted)] line-clamp-3">
                  {project.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {project.stack.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveProjectTitle(project.title);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:opacity-80 transition"
                >
                  {project.linkLabel}
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section
          id="contact"
          className="mt-8 grid gap-6 rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8 lg:grid-cols-[1fr_0.9fr]"
        >
          <div>
            <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-muted)] uppercase">
              Contact
            </p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
              Ready to collaborate on a website, dashboard, or product
              interface.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)] sm:text-base">
              "I'd love to help you bring your dream product to life whether
              you're starting from scratch or need help crossing the finish
              line, feel free to reach out so we can get your project
              launch ready."
            </p>
          </div>

          <div className="grid gap-4">
            {contactItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-4 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm text-[var(--color-muted)]">
                    {item.label}
                  </p>
                  <p className="font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-8 flex flex-col gap-4 rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">
              Check out my socials
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              >
                <BoxIcon name={link.icon} className="text-lg leading-none" />
                {link.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}

function SectionCard({
  eyebrow,
  title,
  icon,
  description,
}: {
  eyebrow: string;
  title: string;
  icon: IconName;
  description: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-muted)] uppercase">
          {eyebrow}
        </p>
      </div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--color-muted)] sm:text-base">
        {description}
      </p>
    </article>
  );
}

function InfoCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: IconName;
  items: string[];
}) {
  return (
    <article className="rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-panel)] text-[var(--color-accent)]">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 text-sm text-[var(--color-muted)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Icon name="check" className="h-4 w-4" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function BoxIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return <i className={`bx ${name} ${className}`.trim()} aria-hidden="true" />;
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const commonProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "sun":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
        </svg>
      );
    case "moon":
      return (
        <svg {...commonProps}>
          <path d="M20 14.2A7.8 7.8 0 1 1 9.8 4c-.1.4-.1.8-.1 1.3A8.9 8.9 0 0 0 18.7 14c.4 0 .8 0 1.3-.1Z" />
        </svg>
      );
    case "spark":
      return (
        <svg {...commonProps}>
          <path d="m12 2 1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2Z" />
          <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" />
        </svg>
      );
    case "user":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "code":
      return (
        <svg {...commonProps}>
          <path d="m9 18-6-6 6-6M15 6l6 6-6 6" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...commonProps}>
          <path d="M8 7V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7" />
          <path d="M4.5 8h15A1.5 1.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-7A1.5 1.5 0 0 1 4.5 8Z" />
          <path d="M3 12h18" />
        </svg>
      );
    case "mail":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...commonProps}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "globe":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
        </svg>
      );
    case "server":
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="16" height="6" rx="2" />
          <rect x="4" y="14" width="16" height="6" rx="2" />
          <path d="M8 7h.01M8 17h.01M12 7h4M12 17h4" />
        </svg>
      );
    case "database":
      return (
        <svg {...commonProps}>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case "layout":
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M9 10v10" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...commonProps}>
          <path d="M14 4c3.6.3 6 2.7 6.3 6.3-2.1 2.6-4.7 4.8-7.7 6.5l-3.1-3.1C11.2 8.7 13.4 6.1 16 4Z" />
          <path d="M10.2 13.8 7 17l-1.5-4.5L10 8" />
          <path d="M13 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          <path d="M6 18c-1.3.3-2.5 1.5-2.8 2.8.9.2 2.1 0 3.1-.9s1.1-2.2.9-3.1Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...commonProps}>
          <path d="m5 12 4.2 4.2L19 6.5" />
        </svg>
      );
    case "menu":
      return (
        <svg {...commonProps}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "close":
      return (
        <svg {...commonProps}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
  }
}

function ProjectDetailView({
  project,
  onBack,
  theme,
  setTheme,
}: {
  project: Project;
  onBack: () => void;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
}) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      <div className="mx-auto w-full max-w-5xl px-6 py-6 sm:px-8 lg:px-12">
        <header className="sticky top-4 z-20 mb-10 flex items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-2 shadow-[var(--shadow-soft)] backdrop-blur">
          <button
            onClick={onBack}
            className="flex h-10 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-4 text-sm font-medium transition hover:bg-[var(--color-surface)]"
          >
            <Icon name="arrow" className="h-4 w-4 rotate-180" />
            Back to Home
          </button>
          <button
            type="button"
            onClick={() =>
              setTheme((current) => (current === "light" ? "dark" : "light"))
            }
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] transition hover:scale-[1.03] hover:bg-[var(--color-surface)]"
          >
            <Icon
              name={theme === "light" ? "moon" : "sun"}
              className="h-5 w-5"
            />
          </button>
        </header>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium tracking-[0.2em] text-[var(--color-muted)] uppercase">
                Case Study
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                {project.title}
              </h1>
              <p className="mt-4 text-xl text-[var(--color-muted)]">
                {project.category}
              </p>
            </div>
            <div className="flex gap-3">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white transition hover:translate-y-[-1px]"
                >
                  <BoxIcon name="bxl-github" className="text-lg" />
                  GitHub Code
                </a>
              )}
              {project.liveUrl && project.liveUrl !== "#" && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
                >
                  <Icon name="globe" className="h-4 w-4" />
                  Live Demo
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-12">
              <div className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-soft)]">
                <h2 className="mb-4 text-2xl font-semibold">Overview</h2>
                <p className="text-lg leading-relaxed text-[var(--color-muted)]">
                  {project.fullDescription}
                </p>
              </div>

              <div>
                <h2 className="mb-6 text-2xl font-semibold">Key Features</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {project.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                        <Icon name="check" className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-8">
                <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold">
                  <Icon name="code" className="h-5 w-5" />
                  Tech Stack
                </h3>
                <div className="space-y-6">
                  {project.technologies.map((tech) => (
                    <div key={tech.name}>
                      <h4 className="text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                        {tech.name}
                      </h4>
                      <p className="mt-1 text-sm font-medium">{tech.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-soft)]">
                <h3 className="mb-4 text-xl font-semibold">
                  Ready to build something similar?
                </h3>
                <p className="mb-6 text-sm text-[var(--color-muted)]">
                  I'm available for freelance projects and collaborations. Let's
                  talk about your vision.
                </p>
                <button
                  onClick={onBack}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white transition hover:translate-y-[-1px]"
                >
                  <Icon name="mail" className="h-4 w-4" />
                  Get In Touch
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
