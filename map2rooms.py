import os
from PIL import Image
from PIL import ImageDraw

# ---------------------------------------------------------
# 1. Configuration & Constants
# ---------------------------------------------------------
MAP_WIDTH = 64
MAP_HEIGHT = 64
TOTAL_TILES = MAP_WIDTH * MAP_HEIGHT

IMG_SCALE = 16 

# ---------------------------------------------------------
# 2. Data Structures
# ---------------------------------------------------------
map_data = []         
edges_list = []       
unique_vertices = []  

# Start our edge ID assignment at 1 for Scratch 1-based lists
current_edge_id = 1

# Room Tracking
map_room_id = [0] * TOTAL_TILES 
room_edges_dict = {}  

# NEW: Flat tracking list for matching Edge ID -> Room ID
edge_to_room_id = []

# ---------------------------------------------------------
# 3. Helper Functions
# ---------------------------------------------------------
def get_tile(x, y):
    if x < 0 or x >= MAP_WIDTH or y < 0 or y >= MAP_HEIGHT:
        return -1  
    index = (y * MAP_WIDTH) + x
    return map_data[index]

def get_or_create_vertex(x, y):
    coord = (float(x), float(y))
    if coord in unique_vertices:
        return unique_vertices.index(coord) + 1
    
    unique_vertices.append(coord)
    return len(unique_vertices)

def add_edge(x1, y1, x2, y2, edge_type_id, room_id=-1):
    global current_edge_id
    assigned_id = current_edge_id
    
    v1_id = get_or_create_vertex(x1, y1)
    v2_id = get_or_create_vertex(x2, y2)
    
    edges_list.append(edge_type_id)
    edges_list.append(v1_id)
    edges_list.append(v2_id)
    
    # NEW: Track room mapping per edge
    edge_to_room_id.append(room_id)
    
    current_edge_id += 3
    return int((assigned_id + 2) / 3)

def flood_fill_void():
    queue_x, queue_y = [], []
    
    for x in range(MAP_WIDTH):
        if get_tile(x, 0) == 0:
            queue_x.append(x); queue_y.append(0)
        if get_tile(x, MAP_HEIGHT - 1) == 0:
            queue_x.append(x); queue_y.append(MAP_HEIGHT - 1)
            
    for y in range(MAP_HEIGHT):
        if get_tile(0, y) == 0:
            queue_x.append(0); queue_y.append(y)
        if get_tile(MAP_WIDTH - 1, y) == 0:
            queue_x.append(MAP_WIDTH - 1); queue_y.append(y)
            
    head = 0
    while head < len(queue_x):
        cx, cy = queue_x[head], queue_y[head]
        head += 1
        
        idx = (cy * MAP_WIDTH) + cx
        if map_data[idx] == 0:
            map_data[idx] = -1 
            
            if cx > 0 and get_tile(cx - 1, cy) == 0:
                queue_x.append(cx - 1); queue_y.append(cy)
            if cx < MAP_WIDTH - 1 and get_tile(cx + 1, cy) == 0:
                queue_x.append(cx + 1); queue_y.append(cy)
            if cy > 0 and get_tile(cx, cy - 1) == 0:
                queue_x.append(cx); queue_y.append(cy - 1)
            if cy < MAP_HEIGHT - 1 and get_tile(cx, cy + 1) == 0:
                queue_x.append(cx); queue_y.append(cy + 1)

def cull_unreachable_pockets():
    visited = [False] * TOTAL_TILES
    regions = []

    for y in range(MAP_HEIGHT):
        for x in range(MAP_WIDTH):
            idx = (y * MAP_WIDTH) + x
            if (map_data[idx] == 0 or map_data[idx] == 2) and not visited[idx]:
                current_region = []
                queue = [idx]
                visited[idx] = True
                
                head = 0
                while head < len(queue):
                    curr = queue[head]
                    head += 1
                    current_region.append(curr)
                    
                    cx = curr % MAP_WIDTH
                    cy = int(curr / MAP_WIDTH)
                    
                    neighbors = [curr - 1, curr + 1, curr - MAP_WIDTH, curr + MAP_WIDTH]
                    for n in neighbors:
                        if 0 <= n < TOTAL_TILES:
                            if (curr % MAP_WIDTH == 0 and n == curr - 1) or (curr % MAP_WIDTH == MAP_WIDTH - 1 and n == curr + 1):
                                continue
                            if (map_data[n] == 0 or map_data[n] == 2) and not visited[n]:
                                visited[n] = True
                                queue.append(n)
                regions.append(current_region)
                
    if len(regions) > 0:
        largest_region = max(regions, key=len)
        for r in regions:
            if r != largest_region:
                for idx in r:
                    map_data[idx] = -1

# ---------------------------------------------------------
# 4. Main Execution
# ---------------------------------------------------------
def main():
    if not os.path.exists("map.txt"):
        print("Error: map.txt not found.")
        return
        
    with open("map.txt", "r") as f:
        map_data.extend([int(t) for t in f.read().split()])
            
    flood_fill_void()
    cull_unreachable_pockets()

    # --- PHASE: SECTOR / ROOM MAPPING ---
    print("Mapping distinct rooms...")
    current_room_id = 1
    
    for y in range(MAP_HEIGHT):
        for x in range(MAP_WIDTH):
            idx = (y * MAP_WIDTH) + x
            
            if map_data[idx] == 0 and map_room_id[idx] == 0:
                queue = [idx]
                map_room_id[idx] = current_room_id
                room_edges_dict[current_room_id] = []
                
                head = 0
                while head < len(queue):
                    curr = queue[head]
                    head += 1
                    
                    neighbors = [curr - MAP_WIDTH, curr + MAP_WIDTH, curr - 1, curr + 1]
                    for n in neighbors:
                        if 0 <= n < TOTAL_TILES:
                            if (curr % MAP_WIDTH == 0 and n == curr - 1) or (curr % MAP_WIDTH == MAP_WIDTH - 1 and n == curr + 1):
                                continue
                            if map_data[n] == 0 and map_room_id[n] == 0:
                                map_room_id[n] = current_room_id
                                queue.append(n)
                                
                current_room_id += 1
    
    print(f"Mapped {current_room_id - 1} distinct rooms.")
            
    # --- PASS 1-4: WALL TRACING ---
    for y in range(MAP_HEIGHT):
        x = 0
        while x < MAP_WIDTH:
            if get_tile(x, y) == 1 and get_tile(x, y - 1) == 0:
                start_x = x
                facing_room = map_room_id[((y - 1) * MAP_WIDTH) + start_x]
                while x < MAP_WIDTH and get_tile(x, y) == 1 and get_tile(x, y - 1) == 0:
                    x += 1
                edge_id = add_edge(start_x, y, x, y, edge_type_id=1, room_id=facing_room if facing_room > 0 else -1)
                if facing_room > 0: room_edges_dict[facing_room].append(edge_id)
            else: x += 1
                
    for y in range(MAP_HEIGHT):
        x = 0
        while x < MAP_WIDTH:
            if get_tile(x, y) == 1 and get_tile(x, y + 1) == 0:
                start_x = x
                facing_room = map_room_id[((y + 1) * MAP_WIDTH) + start_x]
                while x < MAP_WIDTH and get_tile(x, y) == 1 and get_tile(x, y + 1) == 0:
                    x += 1
                edge_id = add_edge(x, y + 1, start_x, y + 1, edge_type_id=1, room_id=facing_room if facing_room > 0 else -1)
                if facing_room > 0: room_edges_dict[facing_room].append(edge_id)
            else: x += 1

    for x in range(MAP_WIDTH):
        y = 0
        while y < MAP_HEIGHT:
            if get_tile(x, y) == 1 and get_tile(x - 1, y) == 0:
                start_y = y
                facing_room = map_room_id[(start_y * MAP_WIDTH) + (x - 1)]
                while y < MAP_HEIGHT and get_tile(x, y) == 1 and get_tile(x - 1, y) == 0:
                    y += 1
                edge_id = add_edge(x, y, x, start_y, edge_type_id=1, room_id=facing_room if facing_room > 0 else -1)
                if facing_room > 0: room_edges_dict[facing_room].append(edge_id)
            else: y += 1

    for x in range(MAP_WIDTH):
        y = 0
        while y < MAP_HEIGHT:
            if get_tile(x, y) == 1 and get_tile(x + 1, y) == 0:
                start_y = y
                facing_room = map_room_id[(start_y * MAP_WIDTH) + (x + 1)]
                while y < MAP_HEIGHT and get_tile(x, y) == 1 and get_tile(x + 1, y) == 0:
                    y += 1
                edge_id = add_edge(x + 1, start_y, x + 1, y, edge_type_id=1, room_id=facing_room if facing_room > 0 else -1)
                if facing_room > 0: room_edges_dict[facing_room].append(edge_id)
            else: y += 1

    # --- PASS 5: RECESSED POCKET DOORS & SPLIT FRAMES ---
    print("Generating recessed pocket doors and split frames...")
    for y in range(MAP_HEIGHT):
        for x in range(MAP_WIDTH):
            if get_tile(x, y) == 2:
                door_edges = []
                room_A = 0
                room_B = 0
                
                # Horizontal Door
                if get_tile(x - 1, y) == 1 or get_tile(x + 1, y) == 1:
                    room_A = map_room_id[((y - 1) * MAP_WIDTH) + x]
                    room_B = map_room_id[((y + 1) * MAP_WIDTH) + x]
                    
                    # 1. Double-sided door (Recessed perfectly at y + 0.5)
                    door_edges.append(add_edge(x, y + 0.5, x + 1, y + 0.5, edge_type_id=2, room_id=room_A if room_A > 0 else room_B))
                    door_edges.append(add_edge(x + 1, y + 0.5, x, y + 0.5, edge_type_id=2, room_id=room_B if room_B > 0 else room_A))
                    
                    # 2. Left Frame (Set to -1)
                    door_edges.append(add_edge(x, y, x, y + 0.5, edge_type_id=1, room_id=-1))       
                    door_edges.append(add_edge(x, y + 0.5, x, y + 1, edge_type_id=1, room_id=-1))   
                    
                    # 3. Right Frame (Set to -1)
                    door_edges.append(add_edge(x + 1, y + 1, x + 1, y + 0.5, edge_type_id=1, room_id=-1)) 
                    door_edges.append(add_edge(x + 1, y + 0.5, x + 1, y, edge_type_id=1, room_id=-1))     
                    
                # Vertical Door
                elif get_tile(x, y - 1) == 1 or get_tile(x, y + 1) == 1:
                    room_A = map_room_id[(y * MAP_WIDTH) + (x - 1)]
                    room_B = map_room_id[(y * MAP_WIDTH) + (x + 1)]
                    
                    # 1. Double-sided door (Recessed perfectly at x + 0.5)
                    door_edges.append(add_edge(x + 0.5, y + 1, x + 0.5, y, edge_type_id=2, room_id=room_A if room_A > 0 else room_B))
                    door_edges.append(add_edge(x + 0.5, y, x + 0.5, y + 1, edge_type_id=2, room_id=room_B if room_B > 0 else room_A))
                    
                    # 2. Top Frame (Set to -1)
                    door_edges.append(add_edge(x + 1, y, x + 0.5, y, edge_type_id=1, room_id=-1))   
                    door_edges.append(add_edge(x + 0.5, y, x, y, edge_type_id=1, room_id=-1))       
                    
                    # 3. Bottom Frame (Set to -1)
                    door_edges.append(add_edge(x, y + 1, x + 0.5, y + 1, edge_type_id=1, room_id=-1)) 
                    door_edges.append(add_edge(x + 0.5, y + 1, x + 1, y + 1, edge_type_id=1, room_id=-1)) 
                
                # Assign all 6 newly created segments to BOTH touching rooms structural lists
                for e_id in door_edges:
                    if room_A > 0 and e_id not in room_edges_dict[room_A]:
                        room_edges_dict[room_A].append(e_id)
                    if room_B > 0 and e_id not in room_edges_dict[room_B]:
                        room_edges_dict[room_B].append(e_id)

    # --- PACKING ROOM ARRAYS ---
    room_start_list = []
    room_len_list = []
    packed_room_edges = []
    
    current_start = 1 
    for r_id in range(1, current_room_id):
        edges = sorted(list(set(room_edges_dict.get(r_id, []))))
        room_start_list.append(current_start)
        room_len_list.append(len(edges))
        packed_room_edges.extend(edges)
        current_start += len(edges)

    # ---------------------------------------------------------
    # 5. File Exports
    # ---------------------------------------------------------
    def clean_num(val):
        return str(int(val)) if val == int(val) else str(val)

    with open("vertexX.txt", "w") as f:
        for coord in unique_vertices: f.write(clean_num(coord[0]) + "\n")
    with open("vertexY.txt", "w") as f:
        for coord in unique_vertices: f.write(clean_num(coord[1]) + "\n")
    print(f"Exported vertices ({len(unique_vertices)})")

    with open("edges.txt", "w") as f:
        for val in edges_list: f.write(str(val) + "\n")
    print(f"Exported edges ({int(len(edges_list)/3)})")

    # NEW: Export edgeId2Roomid.txt flat Stride-1 list
    with open("edgeId2Roomid.txt", "w") as f:
        for val in edge_to_room_id: 
            f.write(str(val) + "\n")
    print(f"Exported edgeId2Roomid.txt ({len(edge_to_room_id)} entries)")

    with open("map_room_id.txt", "w") as f:
        for val in map_room_id: f.write(str(val) + "\n")
    print("Exported map_room_id.txt (4096-entry grid mapping)")

    with open("room_start.txt", "w") as f:
        for val in room_start_list: f.write(str(val) + "\n")
    with open("room_len.txt", "w") as f:
        for val in room_len_list: f.write(str(val) + "\n")
    with open("room_edges.txt", "w") as f:
        for val in packed_room_edges: f.write(str(val) + "\n")
    print(f"Exported room mapping arrays ({len(packed_room_edges)} packed elements)")

    # ---------------------------------------------------------
    # 6. Image Generation (Blueprint Verification)
    # ---------------------------------------------------------
    img_width = MAP_WIDTH * IMG_SCALE
    img_height = MAP_HEIGHT * IMG_SCALE
    img = Image.new("RGB", (img_width, img_height), "#1a1a1a")
    draw = ImageDraw.Draw(img)
    
    i = 0
    while i < len(edges_list):
        e_type = edges_list[i]
        v1_idx = edges_list[i + 1] - 1
        v2_idx = edges_list[i + 2] - 1
        px1 = unique_vertices[v1_idx][0] * IMG_SCALE
        py1 = unique_vertices[v1_idx][1] * IMG_SCALE
        px2 = unique_vertices[v2_idx][0] * IMG_SCALE
        py2 = unique_vertices[v2_idx][1] * IMG_SCALE
        
        line_col = "#00ffcc" if e_type == 1 else "#ffdd00"
        
        draw.line((px1, py1, px2, py2), fill=line_col, width=2)
        radius = 2
        draw.ellipse((px1 - radius, py1 - radius, px1 + radius, py1 + radius), fill="#ff3333")
        draw.ellipse((px2 - radius, py2 - radius, px2 + radius, py2 + radius), fill="#ff3333")
        i += 3
        
    img.save("vector_map_blueprint.png")
    print("Exported vector_map_blueprint.png")

if __name__ == "__main__":
    main()