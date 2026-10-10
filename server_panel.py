#!/usr/bin/env python3
import tkinter as tk
from tkinter import messagebox
import subprocess
import threading
import time
import os
import re
import socket
import sys
import webbrowser

NO_WINDOW = 0x08000000

def hide_console():
    if os.name == "nt":
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0
        return si
    return None

class ServerPanel:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Camera Monitor - Painel de Servidores")
        self.root.geometry("860x780")
        self.root.minsize(680, 560)
        self.root.resizable(True, True)
        # No .exe compilado pelo PyInstaller, __file__ aponta para a pasta temporaria
        # de extracao (_MEIxxxxxx). Alem disso a exe costuma ficar em dist\, entao
        # precisamos descobrir a raiz real do projeto.
        self.project_dir = self.find_project_dir()
        self.pg_bin = self.read_env_value("PG_BIN") or r"D:\PostgreSQL\18\bin"
        self.pg_data = self.read_env_value("PG_DATA") or r"D:\PostgreSQL\18\data"
        self.redis_dir = os.path.join(self.project_dir, "tools", "redis")
        self.redis_server = os.path.join(self.redis_dir, "redis-server.exe")
        self.redis_conf = os.path.join(self.redis_dir, "redis.windows.conf")
        self.redis_cli = os.path.join(self.redis_dir, "redis-cli.exe")
        self.mediamtx = os.path.join(self.project_dir, "mediamtx.exe")
        self.cloudflared = os.path.join(self.project_dir, "cloudflared.exe")
        self.recorder_worker = os.path.join(self.project_dir, "recorder", "worker.js")
        self.recorder_pid_file = os.path.join(self.project_dir, "recorder", "worker.pid")
        self.recorder_log = os.path.join(self.project_dir, "recorder.log")
        self.recorder_err_log = os.path.join(self.project_dir, "recorder-error.log")
        self.ffmpeg = os.path.join(self.project_dir, "tools", "ffmpeg", "bin", "ffmpeg.exe")
        self.recordings_dir = os.path.join(self.project_dir, "recordings")
        self.auto_refresh = True
        self.refresh_interval = 5
        self.tunnel_url = None
        self.recorder_key = self.read_env_value("RECORDING_SERVICE_KEY")
        self.services = {
            "redis": {"name": "Redis", "port": 6379, "status": "stopped", "pid": None},
            "postgresql": {"name": "PostgreSQL", "port": 5432, "status": "stopped", "pid": None},
            "nextjs": {"name": "Next.js", "port": 3000, "status": "stopped", "pid": None},
            "ai-service": {"name": "AI Service", "port": 8000, "status": "stopped", "pid": None},
            "recorder": {"name": "Recorder", "port": 0, "status": "stopped", "pid": None},
            "cloudflare": {"name": "Cloudflare Tunnel", "port": 20241, "status": "stopped", "pid": None}
        }
        self.setup_ui()
        self.write_diagnostics()
        self.start_auto_refresh()

    def write_diagnostics(self):
        """Grava os caminhos resolvidos para conferir se o .exe achou o projeto."""
        try:
            paths = {
                "project_dir": self.project_dir,
                "frozen": str(getattr(sys, "frozen", False)),
                "exe": os.path.abspath(sys.executable),
                "mediamtx": self.mediamtx,
                "cloudflared": self.cloudflared,
                "ffmpeg": self.ffmpeg,
                "redis_server": self.redis_server,
                "recorder_worker": self.recorder_worker,
                "recordings_dir": self.recordings_dir,
                "RECORDING_SERVICE_KEY": "carregado" if self.recorder_key else "AUSENTE",
            }
            lines = [f"{k} = {v}  [{'OK' if (k in ('project_dir','frozen','exe','RECORDING_SERVICE_KEY') or os.path.exists(v)) else 'FALTA'}]"
                     for k, v in paths.items()]
            with open(os.path.join(self.project_dir, "panel-diagnostico.txt"), "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")
        except Exception:
            pass

    @staticmethod
    def find_project_dir():
        """Descobre a raiz do projeto tanto no script .py quanto no .exe (dist\\)."""
        markers = (os.path.join("recorder", "worker.js"), "package.json", ".env")
        override = os.environ.get("PANEL_PROJECT_DIR")
        if override and os.path.isdir(override):
            return os.path.abspath(override)

        if not getattr(sys, "frozen", False):
            return os.path.dirname(os.path.abspath(__file__))

        cur = os.path.dirname(os.path.abspath(sys.executable))
        for _ in range(5):
            if any(os.path.exists(os.path.join(cur, m)) for m in markers):
                return cur
            parent = os.path.dirname(cur)
            if parent == cur:
                break
            cur = parent
        return os.path.dirname(os.path.abspath(sys.executable))

    def read_env_value(self, key):
        try:
            env_path = os.path.join(self.project_dir, ".env")
            if os.path.exists(env_path):
                with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        m = re.match(r'^\s*%s\s*=\s*"?([^"\r\n]*)"?\s*$' % re.escape(key), line)
                        if m:
                            return m.group(1).strip()
        except Exception:
            pass
        return None

    def get_recorder_pid(self):
        try:
            if os.path.exists(self.recorder_pid_file):
                with open(self.recorder_pid_file, "r", encoding="utf-8", errors="ignore") as f:
                    pid = int(f.read().strip())
                    return pid if self.pid_alive(pid) else None
        except Exception:
            pass
        return None

    @staticmethod
    def pid_alive(pid):
        si = hide_console()
        try:
            result = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                                    capture_output=True, text=True, timeout=10,
                                    startupinfo=si, creationflags=NO_WINDOW)
            return str(pid) in result.stdout
        except Exception:
            return False

    def setup_ui(self):
        self.root.configure(bg="#1e1e2e")
        header = tk.Frame(self.root, bg="#181825")
        header.pack(fill=tk.X)
        tf = tk.Frame(header, bg="#181825")
        tf.pack(fill=tk.X, padx=20, pady=(15, 5))
        tk.Label(tf, text="Camera Monitor", font=("Segoe UI", 20, "bold"), fg="#89b4fa", bg="#181825").pack(anchor=tk.W)
        tk.Label(tf, text="Painel de Controle dos Servidores", font=("Segoe UI", 10), fg="#a6adc8", bg="#181825").pack(anchor=tk.W)
        af = tk.Frame(header, bg="#181825")
        af.pack(fill=tk.X, padx=20, pady=(0, 10))
        self.auto_var = tk.BooleanVar(value=True)
        tk.Checkbutton(af, text="Auto-atualizar (5s)", variable=self.auto_var, command=self.toggle_auto_refresh, fg="#a6adc8", bg="#181825", selectcolor="#313244", activebackground="#181825", activeforeground="#a6adc8", font=("Segoe UI", 9)).pack(side=tk.LEFT)
        self.last_update_label = tk.Label(af, text="", font=("Segoe UI", 9), fg="#6c7086", bg="#181825")
        self.last_update_label.pack(side=tk.RIGHT)
        self.status_frame = tk.Frame(self.root, bg="#1e1e2e")
        self.status_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        self.service_widgets = {}
        for key, svc in self.services.items():
            self.create_service_row(key, svc)
        uf = tk.Frame(self.root, bg="#181825")
        uf.pack(fill=tk.X, padx=20, pady=(0, 10))
        tk.Label(uf, text="Links de Acesso:", font=("Segoe UI", 10, "bold"), fg="#89b4fa", bg="#181825").pack(anchor=tk.W, pady=(5, 0))
        self.url_labels = {}
        self.local_ip = self.detect_local_ip()
        self.create_url_label(uf, "local", "Local:", "http://localhost:3000")
        self.create_url_label(uf, "network", "Rede:", f"http://{self.local_ip}:3000" if self.local_ip else "Detectando...")
        self.create_url_label(uf, "tunnel", "Internet:", "Verificando...")
        bf = tk.Frame(self.root, bg="#1e1e2e")
        bf.pack(fill=tk.X, padx=20, pady=(5, 15))
        self.start_all_btn = tk.Button(bf, text="Iniciar Todos", command=self.start_all, bg="#a6e3a1", fg="#1e1e2e", font=("Segoe UI", 10, "bold"), relief=tk.FLAT, cursor="hand2")
        self.start_all_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 5))
        self.stop_all_btn = tk.Button(bf, text="Parar Todos", command=self.stop_all, bg="#f38ba8", fg="#1e1e2e", font=("Segoe UI", 10, "bold"), relief=tk.FLAT, cursor="hand2")
        self.stop_all_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
        self.refresh_btn = tk.Button(bf, text="Atualizar", command=self.force_refresh, bg="#89b4fa", fg="#1e1e2e", font=("Segoe UI", 10, "bold"), relief=tk.FLAT, cursor="hand2")
        self.refresh_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(5, 0))
        self.status_bar = tk.Label(self.root, text="Pronto", font=("Segoe UI", 9), fg="#6c7086", bg="#181825", anchor=tk.W)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM)

    def create_service_row(self, key, svc):
        frame = tk.Frame(self.status_frame, bg="#313244")
        frame.pack(fill=tk.X, pady=4)
        top = tk.Frame(frame, bg="#313244")
        top.pack(fill=tk.X, padx=15, pady=(10, 2))
        ind = tk.Canvas(top, width=12, height=12, bg="#313244", highlightthickness=0)
        ind.pack(side=tk.LEFT, padx=(0, 8))
        dot = ind.create_oval(2, 2, 10, 10, fill="#f38ba8", outline="")
        tk.Label(top, text=svc["name"], font=("Segoe UI", 11, "bold"), fg="#cdd6f4", bg="#313244").pack(side=tk.LEFT)
        sl = tk.Label(top, text="Parado", font=("Segoe UI", 9, "bold"), fg="#f38ba8", bg="#313244")
        sl.pack(side=tk.LEFT, padx=(10, 0))
        btn = tk.Button(top, text="Iniciar", command=lambda k=key: self.toggle_service(k), bg="#a6e3a1", fg="#1e1e2e", font=("Segoe UI", 9, "bold"), relief=tk.FLAT, cursor="hand2", width=10)
        btn.pack(side=tk.RIGHT)
        bot = tk.Frame(frame, bg="#313244")
        bot.pack(fill=tk.X, padx=15, pady=(0, 10))
        tk.Label(bot, text=f"Porta: {svc['port']}" if svc["port"] else "Gravacao de segmentos", font=("Segoe UI", 9), fg="#6c7086", bg="#313244").pack(side=tk.LEFT)
        if key == "nextjs":
            tk.Button(bot, text="Abrir Site", command=lambda: self.open_url("http://localhost:3000"), fg="#89b4fa", bg="#313244", font=("Segoe UI", 9, "bold"), relief=tk.FLAT, cursor="hand2", activebackground="#313244", activeforeground="#b4befe").pack(side=tk.RIGHT)
        self.service_widgets[key] = {"indicator": ind, "dot": dot, "status_label": sl, "btn": btn}

    def create_url_label(self, parent, key, label, default_url):
        f = tk.Frame(parent, bg="#181825")
        f.pack(fill=tk.X, pady=2)
        tk.Label(f, text=label, font=("Segoe UI", 9, "bold"), fg="#a6adc8", bg="#181825", width=10, anchor=tk.W).pack(side=tk.LEFT)
        ul = tk.Label(f, text=default_url, font=("Consolas", 10), fg="#a6e3a1", bg="#181825", anchor=tk.W, cursor="hand2", justify=tk.LEFT)
        ul.pack(side=tk.LEFT, fill=tk.X, expand=True)
        ul.bind("<Button-1>", lambda e, u=default_url: self.open_url(u))
        ul.bind("<Button-3>", lambda e, u=default_url: self.copy_url(u))
        ul.bind("<Enter>", lambda e: ul.config(fg="#b4befe"))
        ul.bind("<Leave>", lambda e: ul.config(fg="#a6e3a1"))
        self.url_labels[key] = ul

    def update_url_label(self, key, url):
        ul = self.url_labels[key]
        ul.config(text=url)
        if url.startswith("http"):
            ul.bind("<Button-1>", lambda e, u=url: self.open_url(u))
            ul.bind("<Button-3>", lambda e, u=url: self.copy_url(u))
        else:
            ul.bind("<Button-1>", lambda e: None)
            ul.bind("<Button-3>", lambda e: None)

    def copy_url(self, url):
        if not url or not url.startswith("http"):
            return
        try:
            self.root.clipboard_clear()
            self.root.clipboard_append(url)
            self.status_bar.config(text=f"URL copiada: {url}")
        except Exception:
            pass

    def detect_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
            finally:
                s.close()
        except Exception:
            return None

    def open_url(self, url):
        if not url or not url.startswith("http"):
            return
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            os.startfile(url)
        except Exception as e:
            self.root.after(0, lambda: self.status_bar.config(text=f"Erro abrindo URL: {str(e)[:60]}"))

    def report_error(self, exc):
        """Tk nao mostra traceback em build --windowed; mostramos na barra de status."""
        try:
            self.status_bar.config(text=f"Erro: {str(exc)[:70]}")
        except Exception:
            pass
        try:
            with open(os.path.join(self.project_dir, "panel-erro.log"), "a", encoding="utf-8") as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {type(exc).__name__}: {exc}\n")
        except Exception:
            pass

    def update_service_ui(self, key, status, pid=None):
        svc = self.services[key]
        svc["status"] = status
        svc["pid"] = pid
        w = self.service_widgets[key]
        if status == "running":
            w["indicator"].itemconfig(w["dot"], fill="#a6e3a1")
            w["status_label"].config(text="Rodando", fg="#a6e3a1")
            w["btn"].config(text="Parar", bg="#f38ba8")
        else:
            w["indicator"].itemconfig(w["dot"], fill="#f38ba8")
            w["status_label"].config(text="Parado", fg="#f38ba8")
            w["btn"].config(text="Iniciar", bg="#a6e3a1")

    def update_tunnel_url(self, url):
        self.tunnel_url = url
        self.url_labels["tunnel"].config(text=url or "Parado")
        if url:
            self.url_labels["tunnel"].bind("<Button-1>", lambda e, u=url: self.open_url(u))
        else:
            self.url_labels["tunnel"].bind("<Button-1>", lambda e: None)

    def get_tunnel_url(self):
        for log_file in ["tunnel-err.log", "tunnel-new-err.log", "tunnel-error.log"]:
            try:
                log_path = os.path.join(self.project_dir, log_file)
                if os.path.exists(log_path):
                    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    matches = re.findall(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com", content)
                    if matches:
                        return matches[-1]
            except Exception:
                pass
        return None

    def check_port(self, port):
        try:
            si = hide_console()
            result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=5, startupinfo=si, creationflags=NO_WINDOW)
            match = re.search(rf":{port}.*LISTENING\s+(\d+)", result.stdout)
            if match:
                return True, int(match.group(1))
        except Exception:
            pass
        return False, None

    def check_service(self, key):
        svc = self.services[key]
        if key == "recorder":
            pid = self.get_recorder_pid()
            self.root.after(0, self.update_service_ui, key, "running" if pid else "stopped", pid)
            return
        running, pid = self.check_port(svc["port"])
        self.root.after(0, self.update_service_ui, key, "running" if running else "stopped", pid)

    def force_refresh(self):
        self.refresh_btn.config(state=tk.DISABLED)
        def do_refresh():
            for key in self.services:
                self.check_service(key)
            ip = self.detect_local_ip()
            if ip:
                net_url = f"http://{ip}:3000"
                if ip != self.local_ip:
                    self.local_ip = ip
                self.root.after(0, self.update_url_label, "network", net_url)
            url = self.get_tunnel_url()
            tunnel_up = self.check_port(20241)[0]
            if tunnel_up and url:
                self.root.after(0, self.update_tunnel_url, url)
            elif not tunnel_up:
                self.root.after(0, self.update_tunnel_url, None)
            self.root.after(0, lambda: self.last_update_label.config(text=f"Atualizado: {time.strftime('%H:%M:%S')}"))
            self.root.after(0, lambda: self.refresh_btn.config(state=tk.NORMAL))
        threading.Thread(target=do_refresh, daemon=True).start()

    def start_service(self, key):
        self.root.after(0, lambda: self.status_bar.config(text=f"Iniciando {self.services[key]['name']}..."))
        def start():
            try:
                si = hide_console()
                if key == "redis":
                    subprocess.Popen([self.redis_server, self.redis_conf], cwd=self.redis_dir, creationflags=NO_WINDOW, startupinfo=si, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(3)
                elif key == "postgresql":
                    pg_ctl = os.path.join(self.pg_bin, "pg_ctl.exe")
                    subprocess.run([pg_ctl, "start", "-D", self.pg_data, "-l", os.path.join(self.pg_data, "startup.log"), "-w"], capture_output=True, timeout=30, startupinfo=si, creationflags=NO_WINDOW)
                    time.sleep(4)
                elif key == "nextjs":
                    subprocess.Popen(["node", "server.js"], cwd=self.project_dir, creationflags=NO_WINDOW, startupinfo=si, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(8)
                elif key == "ai-service":
                    env = os.environ.copy()
                    env["NEXTJS_URL"] = "http://localhost:3000"
                    env["AI_SECRET"] = "camview-ai-secret-2024"
                    subprocess.Popen(
                        ["python", os.path.join(self.project_dir, "ai-service", "main.py")],
                        cwd=self.project_dir, creationflags=NO_WINDOW, startupinfo=si,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
                    time.sleep(5)
                elif key == "mediamtx":
                    if not os.path.exists(self.mediamtx):
                        raise RuntimeError("mediamtx.exe nao encontrado")
                    subprocess.Popen([self.mediamtx, "mediamtx.yml"], cwd=self.project_dir,
                                     creationflags=NO_WINDOW, startupinfo=si,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(4)
                elif key == "recorder":
                    if not self.recorder_key:
                        raise RuntimeError("RECORDING_SERVICE_KEY ausente no .env")
                    if not os.path.exists(self.recorder_worker):
                        raise RuntimeError("recorder/worker.js nao encontrado")
                    ffmpeg = self.ffmpeg if os.path.exists(self.ffmpeg) else "ffmpeg"
                    env = os.environ.copy()
                    env["API_URL"] = "http://localhost:3000"
                    env["RECORDER_KEY"] = self.recorder_key
                    env["FFMPEG"] = ffmpeg
                    env["OUTPUT_DIR"] = self.recordings_dir
                    out = open(self.recorder_log, "a", encoding="utf-8")
                    err = open(self.recorder_err_log, "a", encoding="utf-8")
                    proc = subprocess.Popen(["node", self.recorder_worker], cwd=self.project_dir,
                                            creationflags=NO_WINDOW | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
                                            startupinfo=si, stdout=out, stderr=err, env=env,
                                            close_fds=True)
                    time.sleep(5)
                    del proc
                elif key == "cloudflare":
                    err_log = os.path.join(self.project_dir, "tunnel-err.log")
                    if os.path.exists(err_log):
                        os.remove(err_log)
                    subprocess.Popen(
                        ["powershell", "-NoProfile", "-Command",
                         f"Start-Process '{self.cloudflared}' -ArgumentList 'tunnel','--url','http://127.0.0.1:3000' -RedirectStandardError '{err_log}' -WindowStyle Hidden"],
                        cwd=self.project_dir, creationflags=NO_WINDOW, startupinfo=si,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(12)
                self.check_service(key)
                if key == "cloudflare":
                    time.sleep(3)
                    url = self.get_tunnel_url()
                    if url:
                        self.root.after(0, self.update_tunnel_url, url)
                self.root.after(0, lambda: self.status_bar.config(text=f"{self.services[key]['name']} iniciado"))
            except Exception as e:
                self.root.after(0, lambda: self.status_bar.config(text=f"Erro: {str(e)[:50]}"))
        threading.Thread(target=start, daemon=True).start()

    def stop_service(self, key):
        self.root.after(0, lambda: self.status_bar.config(text=f"Parando {self.services[key]['name']}..."))
        def stop():
            try:
                svc = self.services[key]
                si = hide_console()
                if key == "redis":
                    subprocess.run([self.redis_cli, "shutdown"], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                elif key == "postgresql":
                    pg_ctl = os.path.join(self.pg_bin, "pg_ctl.exe")
                    subprocess.run([pg_ctl, "stop", "-D", self.pg_data, "-m", "fast"], capture_output=True, timeout=30, startupinfo=si, creationflags=NO_WINDOW)
                elif key == "recorder":
                    pid = self.get_recorder_pid()
                    if pid:
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                                       capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                        try:
                            os.remove(self.recorder_pid_file)
                        except Exception:
                            pass
                    time.sleep(2)
                elif key == "mediamtx":
                    if svc["pid"]:
                        subprocess.run(["taskkill", "/F", "/PID", str(svc["pid"])], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                    subprocess.run(["taskkill", "/F", "/IM", "mediamtx.exe"], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                elif svc["pid"]:
                    subprocess.run(["taskkill", "/F", "/PID", str(svc["pid"])], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(svc["pid"])], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                else:
                    # fallback por nome de imagem, sem matar processos alheios (ex: python)
                    for pattern_name in ["next", "cloudflared"]:
                        subprocess.run(["taskkill", "/F", "/IM", f"{pattern_name}.exe"], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                time.sleep(2)
                self.check_service(key)
                if key == "cloudflare":
                    self.root.after(0, self.update_tunnel_url, None)
                self.root.after(0, lambda: self.status_bar.config(text=f"{svc['name']} parado"))
            except Exception as e:
                self.root.after(0, lambda: self.status_bar.config(text=f"Erro: {str(e)[:50]}"))
        threading.Thread(target=stop, daemon=True).start()

    def toggle_service(self, key):
        svc = self.services[key]
        if svc["status"] == "running":
            self.stop_service(key)
        else:
            self.start_service(key)

    def start_all(self):
        self.root.after(0, lambda: self.status_bar.config(text="Iniciando todos os servicos..."))
        self.start_all_btn.config(state=tk.DISABLED)
        def go():
            for key in ["redis", "postgresql", "mediamtx", "nextjs", "ai-service", "recorder", "cloudflare"]:
                if self.services[key]["status"] != "running":
                    self.start_service(key)
                    time.sleep(2)
            self.root.after(0, lambda: self.start_all_btn.config(state=tk.NORMAL))
            self.root.after(0, lambda: self.status_bar.config(text="Todos os servicos iniciados"))
        threading.Thread(target=go, daemon=True).start()

    def stop_all(self):
        self.root.after(0, lambda: self.status_bar.config(text="Parando todos os servicos..."))
        self.stop_all_btn.config(state=tk.DISABLED)
        def go():
            for key in ["cloudflare", "recorder", "ai-service", "mediamtx", "nextjs", "postgresql", "redis"]:
                if self.services[key]["status"] == "running":
                    self.stop_service(key)
                    time.sleep(2)
            self.root.after(0, lambda: self.stop_all_btn.config(state=tk.NORMAL))
            self.root.after(0, lambda: self.status_bar.config(text="Todos os servicos parados"))
        threading.Thread(target=go, daemon=True).start()

    def toggle_auto_refresh(self):
        self.auto_refresh = self.auto_var.get()

    def auto_refresh_loop(self):
        if self.auto_refresh:
            self.force_refresh()
        self.root.after(self.refresh_interval * 1000, self.auto_refresh_loop)

    def start_auto_refresh(self):
        self.force_refresh()
        self.auto_refresh_loop()

    def run(self):
        def on_error(exc_type, exc, tb):
            if issubclass(exc_type, KeyboardInterrupt):
                return
            self.report_error(exc)
            return self.root.destroy()
        sys.excepthook = on_error
        self.root.report_callback_exception = lambda exc, val, tb: self.report_error(val)
        self.root.mainloop()

if __name__ == "__main__":
    app = ServerPanel()
    app.run()