import os
import math
from PIL import Image
from PIL import ImageDraw

# ---------------------------------------------------------
# 1. Configuration & Constants
# ---------------------------------------------------------
MAP_WIDTH = 64
MAP_HEIGHT = 64
TOTAL_TILES = MAP_WIDTH * MAP_HEIGHT

IMG_SCALE = 16 

# Entity type map (Extendable for new asset types)
ENTITY_CHAR_MAP = {
    'a': 1,  # e.g., Player/Enemy start
    'b': 2,  # e.g., Static decoration / Ammo item
    'c': 3   # e.g., Light source billboard
}

# ---------------------------------------------------------
# 2. Data Structures
# ---------------------------------------------------------
map_data = []         
unique_vertices = []  
edges_data = []       

current_edge_id = 1

map_room_id = [0] * TOTAL_TILES 
room_edges_dict = {}  
room_tiles_dict = {}  

# Temporary holding for raw entity instances discovered on load
# TODO: also capture a starting facing/direction per entity (authored in
#       mapEditor.py) so it can be packed into the rooms list entity block.
entities_found = []

room_start_list = []
room_len_list = []

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

def add_edge(x1, y1, x2, y2, edge_type_id):
    global current_edge_id
    assigned_id = current_edge_id
    
    v1_id = get_or_create_vertex(x1, y1)
    v2_id = get_or_create_vertex(x2, y2)
    
    dx = x2 - x1
    dy = y2 - y1
    
    num_tiles = int(math.ceil(math.hypot(dx, dy)))
    c_face = 1 if dx == 0 else 0  
    normal_angle = int(round((math.degrees(math.atan2(dy, dx)) - 90) % 360))
    
    edges_data.append({
        'id': assigned_id,
        'type': edge_type_id,
        'v1': v1_id,
        'v2': v2_id,
        'num_tiles': num_tiles,
        'c_face': c_face,
        'normal_angle': normal_angle
    })
    
    current_edge_id += 1
    return assigned_id

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
        tokens = f.read().split()

    # Process tokens strings safely to pull out entity coordinates
    for idx, token in enumerate(tokens):
        x = idx % MAP_WIDTH
        y = idx // MAP_WIDTH
        
        if token.isdigit():
            map_data.append(int(token))
        else:
            # Found alpha entity! Look up numerical ID
            char_lower = token.lower()
            type_id = ENTITY_CHAR_MAP.get(char_lower, 1)
            
            # Place the entity exactly in the center of the 1x1 grid square
            entities_found.append({
                'type': type_id,
                'wx': x + 0.5,
                'wz': y + 0.5,
                'tile_idx': idx
            })
            # Overwrite token back into walkable floor space for standard tracing
            map_data.append(0)
            
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
                room_tiles_dict[current_room_id] = [] 
                
                head = 0
                while head < len(queue):
                    curr = queue[head]
                    head += 1
                    
                    room_tiles_dict[current_room_id].append(curr + 1)
                    
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
    
    # --- PHASE: ASSIGN ENTITIES TO ROOMS ---
    room_entities_dict = {r_id: [] for r_id in range(1, current_room_id)}
    
    for ent in entities_found:
        r_id = map_room_id[ent['tile_idx']]
        if r_id > 0:
            # Store [tile_idx (1-indexed for Scratch), type]
            room_entities_dict[r_id].append({'tile_idx': ent['tile_idx'] + 1, 'type': ent['type']})
            
    # --- PASS 1-4: WALL TRACING ---
    for y in range(MAP_HEIGHT):
        x = 0
        while x < MAP_WIDTH:
            if get_tile(x, y) == 1 and get_tile(x, y - 1) == 0:
                start_x = x
                facing_room = map_room_id[((y - 1) * MAP_WIDTH) + start_x]
                while x < MAP_WIDTH and get_tile(x, y) == 1 and get_tile(x, y - 1) == 0:
                    x += 1
                edge_id = add_edge(start_x, y, x, y, edge_type_id=1)
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
                edge_id = add_edge(x, y + 1, start_x, y + 1, edge_type_id=1)
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
                edge_id = add_edge(x, y, x, start_y, edge_type_id=1)
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
                edge_id = add_edge(x + 1, start_y, x + 1, y, edge_type_id=1)
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
                
                if get_tile(x - 1, y) == 1 or get_tile(x + 1, y) == 1:
                    room_A = map_room_id[((y - 1) * MAP_WIDTH) + x]
                    room_B = map_room_id[((y + 1) * MAP_WIDTH) + x]
                    
                    door_edges.append(add_edge(x, y + 0.5, x + 1, y + 0.5, edge_type_id=2))
                    door_edges.append(add_edge(x + 1, y + 0.5, x, y + 0.5, edge_type_id=2))
                    door_edges.append(add_edge(x, y, x, y + 0.5, edge_type_id=1))       
                    door_edges.append(add_edge(x, y + 0.5, x, y + 1, edge_type_id=1))   
                    door_edges.append(add_edge(x + 1, y + 1, x + 1, y + 0.5, edge_type_id=1)) 
                    door_edges.append(add_edge(x + 1, y + 0.5, x + 1, y, edge_type_id=1))     
                    
                elif get_tile(x, y - 1) == 1 or get_tile(x, y + 1) == 1:
                    room_A = map_room_id[(y * MAP_WIDTH) + (x - 1)]
                    room_B = map_room_id[(y * MAP_WIDTH) + (x + 1)]
                    
                    door_edges.append(add_edge(x + 0.5, y + 1, x + 0.5, y, edge_type_id=2))
                    door_edges.append(add_edge(x + 0.5, y, x + 0.5, y + 1, edge_type_id=2))
                    door_edges.append(add_edge(x + 1, y, x + 0.5, y, edge_type_id=1))   
                    door_edges.append(add_edge(x + 0.5, y, x, y, edge_type_id=1))       
                    door_edges.append(add_edge(x, y + 1, x + 0.5, y + 1, edge_type_id=1)) 
                    door_edges.append(add_edge(x + 0.5, y + 1, x + 1, y + 1, edge_type_id=1)) 
                
                for e_id in door_edges:
                    if room_A > 0 and e_id not in room_edges_dict[room_A]:
                        room_edges_dict[room_A].append(e_id)
                    if room_B > 0 and e_id not in room_edges_dict[room_B]:
                        room_edges_dict[room_B].append(e_id)

    # --- PACKING MASTER SECTOR LIST & INVERSE MAP COMPILATION ---
    rooms_list = []
    room_ptr_list = []
    room_texture_list = [] 
    
    edge_to_rooms = {e['id']: [] for e in edges_data}
    current_room_index = 1 
    
    for r_id in range(1, current_room_id):
        room_ptr_list.append(current_room_index)
        
        room_edges = sorted(list(set(room_edges_dict.get(r_id, []))))
        room_tiles = sorted(list(set(room_tiles_dict.get(r_id, [])))) 
        
        for e_id in room_edges:
            if r_id not in edge_to_rooms[e_id]:
                edge_to_rooms[e_id].append(r_id)
        
        room_vertices_set = set()
        for e_id in room_edges:
            edge = edges_data[e_id - 1] 
            room_vertices_set.add(edge['v1'])
            room_vertices_set.add(edge['v2'])
        room_vertices = sorted(list(room_vertices_set))

        min_x, min_y = float('inf'), float('inf')
        max_x, max_y = float('-inf'), float('-inf')

        for v_id in room_vertices:
            vx, vy = unique_vertices[v_id - 1]
            if vx < min_x: min_x = vx
            if vy < min_y: min_y = vy
            if vx > max_x: max_x = vx
            if vy > max_y: max_y = vy
        
        min_x = int(min_x) if min_x == int(min_x) else min_x
        min_y = int(min_y) if min_y == int(min_y) else min_y
        max_x = int(max_x) if max_x == int(max_x) else max_x
        max_y = int(max_y) if max_y == int(max_y) else max_y
        
        num_tiles = len(room_tiles)
        door_edge_count = sum(1 for e_id in room_edges if edges_data[e_id - 1]['type'] == 2)
        num_doors = door_edge_count // 2
        
        if num_tiles >= 64:
            texture_id = 3
        elif num_doors <= 1:
            texture_id = 1
        else:
            texture_id = 2
            
        room_texture_list.append(texture_id)

        num_v = len(room_vertices)
        num_e = len(room_edges)
        num_t = len(room_tiles)
        
        # Pull harvested Entity indices for this room
        r_entities = room_entities_dict.get(r_id, [])
        num_ent = len(r_entities) # This is the number of entities
        
        # 1. 4-Item Structural Header [V, E, F, Ent]
        rooms_list.append(num_v) 
        rooms_list.append(num_e) 
        rooms_list.append(num_t) 
        rooms_list.append(num_ent) 
        
        # 2. Dynamic Strides
        rooms_list.extend(room_vertices)
        rooms_list.extend(room_edges)
        rooms_list.extend(room_tiles) 
        
        # 3. Fixed Bounding Box Block (4 values)
        rooms_list.extend([min_x, min_y, max_x, max_y])
        
        # 4. Local Entity Block (2-Stride: [tile_idx, type])
        # TODO: extend each entity to a 3-stride [tile_idx, type, direction] once the
        #       map editor authors a starting facing per entity. Also bump the
        #       pointer-math shift below from (num_ent * 2) to (num_ent * 3).
        for ent in r_entities:
            rooms_list.extend([ent['tile_idx'], ent['type']])
        
        # Pointer Math Shift tracker updating
        current_room_index += 4 + num_v + num_e + num_t + 4 + (num_ent * 2)

    # ---------------------------------------------------------
    # 5. File Exports
    # ---------------------------------------------------------
    def clean_num(val):
        return str(int(val)) if val == int(val) else str(val)

    export_dir = "MapBakedLists"
    os.makedirs(export_dir, exist_ok=True)

    with open(f"{export_dir}/map_export.txt", "w") as f:
        f.write("[" + ", ".join(map(str, [0 if i == -1 else i for i in map_data])) + "]")
    
    packed_vertices = []
    for v in unique_vertices:
        packed_vertices.extend([clean_num(v[0]), clean_num(v[1])])
        
    with open(f"{export_dir}/vertex.txt", "w") as f:
        f.write("[" + ", ".join(packed_vertices) + "]")
    print(f"Exported vertices ({len(unique_vertices)})")

    with open(f"{export_dir}/edges.txt", "w") as f:
        f.write("[" + ", ".join(
            str(val)
            for d in edges_data
            for key in ['type', 'v1', 'v2', 'num_tiles', 'c_face', 'normal_angle']
            for val in [d[key]]
        ) + "]")
    print(f"Exported edges ({int(len(edges_data))})")


    with open(f"{export_dir}/edgeId2Roomid.txt", "w") as f:
        f.write("[")
        for edge in edges_data:
            e_id = edge['id']
            rooms = edge_to_rooms[e_id]
            room1 = rooms[0] if len(rooms) > 0 else 0            
            f.write(str(room1) + ", ")
        f.write("]")
    print(f"Exported edgeId2Roomid.txt ({len(edges_data)}) entries")

    with open(f"{export_dir}/map_room_id.txt", "w") as f:
        f.write("[" + ", ".join(map(str, map_room_id)) + "]")
    print(f"Exported map_room_id.txt (4096-entry grid mapping)")

    with open(f"{export_dir}/rooms.txt", "w") as f:
        f.write("[" + ", ".join(map(str, rooms_list)) + "]")
    print(f"Exported room mapping arrays ({len(rooms_list)} packed elements)")

    with open(f"{export_dir}/room_ptr.txt", "w") as f:
         f.write("[" + ", ".join(map(str, room_ptr_list)) + "]")
    print(f"Exported room_ptr.txt ({len(room_ptr_list)} pointers)")

    print(f"Exported {int(len(r_entities))} entities to rooms list")
    print(f"Successfully exported all comma-separated lists to ./{export_dir}/")

    # ---------------------------------------------------------
    # 6. Image Generation (Blueprint Verification)
    # ---------------------------------------------------------
    img_width = MAP_WIDTH * IMG_SCALE
    img_height = MAP_HEIGHT * IMG_SCALE
    img = Image.new("RGB", (img_width, img_height), "#1a1a1a")
    draw = ImageDraw.Draw(img)
    
    for edge in edges_data:
        e_type = edge['type']
        v1_idx = edge['v1'] - 1
        v2_idx = edge['v2'] - 1
        px1 = unique_vertices[v1_idx][0] * IMG_SCALE
        py1 = unique_vertices[v1_idx][1] * IMG_SCALE
        px2 = unique_vertices[v2_idx][0] * IMG_SCALE
        py2 = unique_vertices[v2_idx][1] * IMG_SCALE
        
        line_col = "#00ffcc" if e_type == 1 else "#ffdd00"
        draw.line((px1, py1, px2, py2), fill=line_col, width=2)
        
        radius = 2
        draw.ellipse((px1 - radius, py1 - radius, px1 + radius, py1 + radius), fill="#ff3333")
        draw.ellipse((px2 - radius, py2 - radius, px2 + radius, py2 + radius), fill="#ff3333")
        
    img.save(f"{export_dir}/vector_map_blueprint.png")
    print("Exported vector_map_blueprint.png")

if __name__ == "__main__":
    main()