#!/usr/bin/env python3
import tkinter as tk
from tkinter import messagebox
import subprocess
import threading
import time
import os
import re
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
        self.root.geometry("620x600")
        self.root.resizable(False, False)
        self.project_dir = r"F:\SistemaDeCameras-main"
        self.pg_bin = r"C:\Program Files\PostgreSQL\16\bin"
        self.pg_data = r"C:\Program Files\PostgreSQL\16\data"
        self.cloudflared = os.path.join(self.project_dir, "cloudflared.exe")
        self.node_exe = os.path.join(self.project_dir, "node_modules", ".bin", "next.cmd")
        self.auto_refresh = True
        self.refresh_interval = 5
        self.tunnel_url = None
        self.services = {
            "postgresql": {"name": "PostgreSQL", "port": 5432, "status": "stopped", "pid": None},
            "nextjs": {"name": "Next.js", "port": 3000, "status": "stopped", "pid": None},
            "cloudflare": {"name": "Cloudflare Tunnel", "port": 20241, "status": "stopped", "pid": None}
        }
        self.setup_ui()
        self.start_auto_refresh()

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
        self.create_url_label(uf, "local", "Local:", "http://localhost:3000")
        self.create_url_label(uf, "network", "Rede:", "http://192.168.1.101:3000")
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
        tk.Label(bot, text=f"Porta: {svc['port']}", font=("Segoe UI", 9), fg="#6c7086", bg="#313244").pack(side=tk.LEFT)
        if key == "nextjs":
            tk.Button(bot, text="Abrir Site", command=lambda: self.open_url("http://localhost:3000"), fg="#89b4fa", bg="#313244", font=("Segoe UI", 9, "bold"), relief=tk.FLAT, cursor="hand2", activebackground="#313244", activeforeground="#b4befe").pack(side=tk.RIGHT)
        self.service_widgets[key] = {"indicator": ind, "dot": dot, "status_label": sl, "btn": btn}

    def create_url_label(self, parent, key, label, default_url):
        f = tk.Frame(parent, bg="#181825")
        f.pack(fill=tk.X, pady=2)
        tk.Label(f, text=label, font=("Segoe UI", 9, "bold"), fg="#a6adc8", bg="#181825", width=10, anchor=tk.W).pack(side=tk.LEFT)
        ul = tk.Label(f, text=default_url, font=("Consolas", 9), fg="#a6e3a1", bg="#181825", anchor=tk.W, cursor="hand2")
        ul.pack(side=tk.LEFT, fill=tk.X, expand=True)
        ul.bind("<Button-1>", lambda e, u=default_url: self.open_url(u))
        ul.bind("<Enter>", lambda e: ul.config(fg="#b4befe"))
        ul.bind("<Leave>", lambda e: ul.config(fg="#a6e3a1"))
        self.url_labels[key] = ul

    def open_url(self, url):
        if url and url not in ("Verificando...", "Parado", ""):
            webbrowser.open(url)

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
        running, pid = self.check_port(svc["port"])
        self.root.after(0, self.update_service_ui, key, "running" if running else "stopped", pid)

    def force_refresh(self):
        self.refresh_btn.config(state=tk.DISABLED)
        def do_refresh():
            for key in self.services:
                self.check_service(key)
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
                if key == "postgresql":
                    pg_ctl = os.path.join(self.pg_bin, "pg_ctl.exe")
                    subprocess.run([pg_ctl, "start", "-D", self.pg_data, "-l", os.path.join(self.pg_data, "startup.log"), "-w"], capture_output=True, timeout=30, startupinfo=si, creationflags=NO_WINDOW)
                    time.sleep(4)
                elif key == "nextjs":
                    subprocess.Popen([self.node_exe, "start", "-p", "3000", "-H", "0.0.0.0"], cwd=self.project_dir, creationflags=NO_WINDOW, startupinfo=si, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(8)
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
                if key == "postgresql":
                    pg_ctl = os.path.join(self.pg_bin, "pg_ctl.exe")
                    subprocess.run([pg_ctl, "stop", "-D", self.pg_data, "-m", "fast"], capture_output=True, timeout=30, startupinfo=si, creationflags=NO_WINDOW)
                elif svc["pid"]:
                    subprocess.run(["taskkill", "/F", "/PID", str(svc["pid"])], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(svc["pid"])], capture_output=True, timeout=10, startupinfo=si, creationflags=NO_WINDOW)
                else:
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
            for key in ["postgresql", "nextjs", "cloudflare"]:
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
            for key in ["cloudflare", "nextjs", "postgresql"]:
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
        self.root.mainloop()

if __name__ == "__main__":
    app = ServerPanel()
    app.run()