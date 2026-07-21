import os
import tkinter as tk
from tkinter import filedialog, messagebox

MAP_WIDTH = 64
MAP_HEIGHT = 64
CELL_SIZE = 12  # Pixel size per tile cell on screen

# Color palette and labels for tile types
# TODO: entities need a starting facing/direction authored in the editor
#       (e.g. per-cell facing, or a direction token appended to the entity glyph)
#       so it can be exported into map.txt and carried through map2rooms.py ->
#       rooms.txt -> process_room Pass 3 -> frameEntity -> entityShader.gs.
TILES = {
    '0': ('#222222', '0: Floor'),
    '1': ('#00ffcc', '1: Wall'),
    '2': ('#ffdd00', '2: Door'),
    'a': ('#ff3366', 'a: Entity A'),
    'b': ('#ff8800', 'b: Entity B'),
    'c': ('#aa00ff', 'c: Entity C'),
}

class MapEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("64x64 Map Visual Editor")
        
        self.active_tile = '1'
        self.grid_data = ['0'] * (MAP_WIDTH * MAP_HEIGHT)
        
        # UI Setup
        self.create_controls()
        self.create_canvas()
        
        # Load existing map.txt if present
        if os.path.exists("map.txt"):
            self.load_file("map.txt")

    def create_controls(self):
        control_frame = tk.Frame(self.root, bg="#1a1a1a")
        control_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)
        
        tk.Label(control_frame, text="Tools:", fg="white", bg="#1a1a1a").pack(side=tk.LEFT, padx=5)
        
        self.tile_buttons = {}
        for key, (color, label) in TILES.items():
            btn = tk.Button(
                control_frame, text=label, bg=color, fg="black" if key != '0' else "white",
                command=lambda k=key: self.set_active_tile(k), relief=tk.RAISED, bd=2
            )
            btn.pack(side=tk.LEFT, padx=3)
            self.tile_buttons[key] = btn
            
        self.set_active_tile('1')
        
        # File operations
        tk.Button(control_frame, text="Save (map.txt)", bg="#28a745", fg="white", command=self.save_file).pack(side=tk.RIGHT, padx=5)
        tk.Button(control_frame, text="Load Map", bg="#007bff", fg="white", command=self.open_file).pack(side=tk.RIGHT, padx=5)
        tk.Button(control_frame, text="Clear Floor", bg="#dc3545", fg="white", command=self.clear_map).pack(side=tk.RIGHT, padx=5)

    def create_canvas(self):
        canvas_width = MAP_WIDTH * CELL_SIZE
        canvas_height = MAP_HEIGHT * CELL_SIZE
        
        self.canvas = tk.Canvas(self.root, width=canvas_width, height=canvas_height, bg="#000000")
        self.canvas.pack(padx=10, pady=10)
        
        # Mouse bindings for drag-drawing
        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<B1-Motion>", self.on_click)

    def set_active_tile(self, key):
        self.active_tile = key
        for k, btn in self.tile_buttons.items():
            if k == key:
                btn.config(relief=tk.SUNKEN, bd=4)
            else:
                btn.config(relief=tk.RAISED, bd=2)

    def on_click(self, event):
        x = event.x // CELL_SIZE
        y = event.y // CELL_SIZE
        
        if 0 <= x < MAP_WIDTH and 0 <= y < MAP_HEIGHT:
            idx = y * MAP_WIDTH + x
            if self.grid_data[idx] != self.active_tile:
                self.grid_data[idx] = self.active_tile
                self.draw_cell(x, y)

    def draw_cell(self, x, y):
        idx = y * MAP_WIDTH + x
        val = self.grid_data[idx]
        color, _ = TILES.get(val, ('#222222', ''))
        
        x1 = x * CELL_SIZE
        y1 = y * CELL_SIZE
        x2 = x1 + CELL_SIZE
        y2 = y1 + CELL_SIZE
        
        tag = f"cell_{x}_{y}"
        self.canvas.delete(tag)
        
        self.canvas.create_rectangle(x1, y1, x2, y2, fill=color, outline="#111111", tags=tag)
        
        # Display entity letters inside the cell
        if val.isalpha():
            self.canvas.create_text((x1 + x2)//2, (y1 + y2)//2, text=val.upper(), fill="white", font=("Arial", 8, "bold"), tags=tag)

    def redraw_all(self):
        self.canvas.delete("all")
        for y in range(MAP_HEIGHT):
            for x in range(MAP_WIDTH):
                self.draw_cell(x, y)

    def load_file(self, filepath):
        try:
            with open(filepath, "r") as f:
                tokens = f.read().split()
                if len(tokens) >= MAP_WIDTH * MAP_HEIGHT:
                    self.grid_data = tokens[:MAP_WIDTH * MAP_HEIGHT]
                    self.redraw_all()
                else:
                    messagebox.showerror("Error", "File does not contain 4096 tokens.")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file: {e}")

    def open_file(self):
        path = filedialog.askopenfilename(filetypes=[("Text Files", "*.txt")])
        if path:
            self.load_file(path)

    def save_file(self):
        try:
            with open("map.txt", "w") as f:
                f.write("\n".join(self.grid_data))
            messagebox.showinfo("Success", "Saved successfully to map.txt!")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save map.txt: {e}")

    def clear_map(self):
        if messagebox.askyesno("Clear Map", "Reset all tiles to 0 (Floor)?"):
            self.grid_data = ['0'] * (MAP_WIDTH * MAP_HEIGHT)
            self.redraw_all()

if __name__ == "__main__":
    root = tk.Tk()
    root.configure(bg="#1a1a1a")
    app = MapEditor(root)
    root.mainloop()