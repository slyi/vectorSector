hide;
costumes "assets/91223aa3.svg" as "blank";

# =================================================================
# --- SPRITE VARIABLES (Declared at the top, no inline vars) -----
# =================================================================

# Player & Camera State
var playerX = 0;
var playerY = 0;
var playerDir = 0;
var focalLength = 240;

var moveStep;
var isTurning;
var camCos;
var camSin;
var rayCastTime = 0;


var doorOpenRatio = 0;
var doorTimer = 0;
var activeDoorIndex = 0;

# Room/Sector Engine Variables
var currentTile;
var currentRoom;
var connectedRoom;
var adj1; var adj2; var adj3; var adj4;

var edge_id;
var list_idx;
var tile_type;

var v1_id;
var v2_id;
var v1_ptr;
var v2_ptr;

var dx1; var dy1;
var dx2; var dy2;
var tx1; var tz1;
var tx2; var tz2;

# World coordinate variables for vector sliding
var wx1; var wy1;
var wx2; var wy2;


var is_visible;
var t_clip;
var rx1; 
var rx2; 

# Sorting Variables

var best_idx;
var ptr;
var t_len;
var curr_depth;

# Movement & Collision Variables
var newX; var newY;
var tileX; var tileY;


var furthest_wall_depth = 0;


# =================================================================
# --- LISTS (Load your generated .txt files into these baked map lists) -----------
# =================================================================
# run python map2room.py map.txt
list map = [%include MapBakedLists/map_export.txt%];
list map_room_id = [%include MapBakedLists/map_room_id.txt%];
list rooms = [%include MapBakedLists/rooms.txt%];
list room_ptr = [%include MapBakedLists/room_ptr.txt%];
list edges = [%include MapBakedLists/edges.txt%];
list vertex = [%include MapBakedLists/vertex.txt%];
list edge2Room = [%include MapBakedLists/edgeId2Roomid.txt%];


list roomTexture = [3, 1, 2, 1, 2, 2, 1, 2, 3, 1, 3, 3, 3, 2, 2, 1, 1, 2, 2, 2, 2, 1, 2, 1, 1, 4, 1];

list edgeSort = [];
list span_buffer=[];

list l_tx = [];
list l_tz = [];
list l_rx1 =[];
list l_rx2 =[];
list l_tz1 =[];
list l_tz2 =[];


onflag {
    init;  
}

on "_2.5DEngine" {

    mainLoop;

}

proc mainLoop{
       
    _3dTime = days_since_2000() * 86400000;
    isTurning = key_pressed("a") or key_pressed("d");
    moveStep = (key_pressed("w") - key_pressed("s")) / 10;
    playerDir += (key_pressed("d") - key_pressed("a")) * 5;
    
    movePlayer moveStep;
    updateDoor;
    
    _c "#Cache trig to save Scratch CPU";
    camCos = cos(playerDir);
    camSin = sin(playerDir);
    
    _c "#1. 3D Engine: Process vectors and build sorted queue";
    
    _3dEngine;
    _3dTime = round(days_since_2000() * 86400000 - _3dTime);
                
}

proc _3dEngine {
    _c "#3D ENGINE (SECTORS, TRANSFORM, CLIP, SORT)";
    delete edgeSort;
    delete walls;    
    delete frameEdge;
    delete frameEntity;

    furthest_wall_depth = 0;
    vLineIdx=0;
    
    _c "#1. Find which Room Sector the player is standing in";
    currentTile = floor(playerX) + floor(playerY) * 64 + 1;
    currentRoom = map_room_id[currentTile];
    connectedRoom = -1;

    if map[currentTile] == 2 {
        adj1 = map_room_id[currentTile - 64];
        adj2 = map_room_id[currentTile + 64]; 
        adj3 = map_room_id[currentTile - 1];  
        adj4 = map_room_id[currentTile + 1];
        
        if adj1 > 0 { 
            currentRoom = adj1;
            connectedRoom = adj2; 
        } elif adj3 > 0 { 
            currentRoom = adj3;
            connectedRoom = adj4; 
        }
    }
    elif doorOpenRatio > 0 and activeDoorIndex > 0 {
        adj1 = map_room_id[activeDoorIndex - 64];
        adj2 = map_room_id[activeDoorIndex + 64];
        adj3 = map_room_id[activeDoorIndex - 1];
        adj4 = map_room_id[activeDoorIndex + 1];
        
        if adj1 > 0 and not (adj1 == currentRoom) { connectedRoom = adj1; }
        elif adj2 > 0 and not (adj2 == currentRoom) { connectedRoom = adj2; }
        elif adj3 > 0 and not (adj3 == currentRoom) { connectedRoom = adj3; }
        elif adj4 > 0 and not (adj4 == currentRoom) { connectedRoom = adj4; }
    }
    if doorOpenRatio > 0 {
        _c "#If the door is open/opening, lock onto the connected room ONLY ONCE";
        if cachedFloorRoom == 0 and connectedRoom > 0 {
            cachedFloorRoom = connectedRoom;
        }
    } else {
        _c "#Door is completely closed: release the lock";
        cachedFloorRoom = 0;
    }
    _c "#3. Process room geometries";
    
    if connectedRoom > 0 { process_room connectedRoom;  }
    if currentRoom > 0 { process_room currentRoom; }
   

    _c "#=================================================================";
    _c "#--- 5. FRONT-TO-BACK SORT & 1D SPAN BUFFER CLIPPING -------------";
    _c "#=================================================================";

    total_walls = length(edgeSort) / 2;
    processed = 0;

    until processed == total_walls {
        _c "#1. FIND THE CLOSEST WALL (Front-to-Back Sort)";
        min_depth = 9999;
        best_idx = 1;
        ptr = 1;
        t_len = length(edgeSort);

        until ptr > t_len {
            curr_depth = edgeSort[ptr];
            if curr_depth < min_depth {
                min_depth = curr_depth;
                best_idx = ptr;
            }
            ptr += 2;
        }

        _c "#2. EXTRACT WALL DATA";
        c_id = edgeSort[best_idx + 1];
        _c "#Tombstone: Infinity prevents re-selection";
        edgeSort[best_idx] = 9999;
        processed += 1;
        
        _c "#New Stride 6 lookup";
        list_idx = ((c_id - 1) * 6) + 1;
        c_rx1 = l_rx1[c_id]; c_tz1 = l_tz1[c_id];
        c_rx2 = l_rx2[c_id]; c_tz2 = l_tz2[c_id];
        
        c_type = edges[list_idx];
        
        _c "#Read pre-baked c_face from stride 6 list instead of manual check";
        c_face = edges[list_idx + 4];

        _c "#3. SPAN BUFFER CLIPPING LOGIC";
        sx1 = round(c_rx1);
        if sx1 < -240 { sx1 = -240; }
        sx2 = round(c_rx2);
        if sx2 > 240 { sx2 = 240; }
        
        _c "#Map -240 -> index 1";
        screen_idx = sx1 + 241;
        _c "#Map  240 -> index 481";
        end_idx = sx2 + 241;
        
        is_visible = 0;
        start_vis_x = 0;
        
        _c "#Pre-calculate inverse Z for perspective-correct clipping";
        inv_z1 = 1 / c_tz1;
        inv_z2 = 1 / c_tz2;
        z_range = inv_z2 - inv_z1;
        x_range = c_rx2 - c_rx1;
        
        _c "#Protect against potential division-by-zero on degenerate zero-width walls";
        if not (x_range == 0) {
            until screen_idx > end_idx {
                if span_buffer[screen_idx] != frameCount {
                    if is_visible == 0 {
                        is_visible = 1;
                        start_vis_x = screen_idx - 241;
                    }
                    span_buffer[screen_idx] = frameCount;
                } else {
                    if is_visible == 1 {
                        _c "#We hit an occluded column! Slice the segment here.";
                        is_visible = 0;
                        end_vis_x = screen_idx - 241 - 1;
                        
                        new_tz1 = 1 / (inv_z1 + (((start_vis_x - c_rx1) / x_range) * z_range));
                        new_tz2 = 1 / (inv_z1 + (((end_vis_x - c_rx1) / x_range) * z_range));
                        
                        insertWall;                         
                        
                    }
                }
                screen_idx += 1;
            }
            
            _c "#Catch the remaining visible segment at the end of the wall";
            if is_visible == 1 {
                new_tz1 = 1 / (inv_z1 + (((start_vis_x - c_rx1) / x_range) * z_range));
                new_tz2 = 1 / (inv_z1 + (((sx2 - c_rx1) / x_range) * z_range));
                end_vis_x= sx2;
                insertWall;
            }
        }
    }
    _c "#4. Populate Tiles/Bounding Box for exactly ONE room floor";
    delete frustrumFloorTiles;
    if cachedFloorRoom > 0 {
        roomTextureId = roomTexture[cachedFloorRoom];
    }
    else {
        roomTextureId = roomTexture[currentRoom];
    }
    if roomTextureId < 5 {
        if cachedFloorRoom > 0 {
            if roomTextureId == 1 or roomTextureId == 4 {
                harvest_floor_tiles cachedFloorRoom;
            }
            elif roomTextureId == 2  or roomTextureId == 3 {
                getRoomBB cachedFloorRoom;
            }
        }
        elif roomTextureId == 1 or roomTextureId == 4 {
            harvest_floor_tiles currentRoom;
        }
        elif roomTextureId == 2 or roomTextureId == 3  {
            getRoomBB currentRoom;
        }
    }
   
    frameCount += 1;
}

proc harvest_floor_tiles targetRoom {
    _c "#PASS 3: HIGHLY OPTIMIZED PARITY-FILTERED HARVESTER";
    _c "#Find where this room's data block begins";
    read_ptr = room_ptr[$targetRoom];
    
    _c "#Extract header counts";
    v_len = rooms[read_ptr];
    e_len = rooms[read_ptr + 1];
    f_len = rooms[read_ptr + 2];
    
    _c "#Advance pointer past Header (3) + Vertices + Edges to reach Floor Tile IDs";
    read_ptr = read_ptr + 4 + v_len + e_len;
    quadrant = floor(((playerDir % 360) + 360) % 360 / 90);
    repeat f_len {
        currentTile = rooms[read_ptr]; 
        
        _c "#1. Unpack 1D index to 2D grid coordinates";
        tileX = (currentTile - 1) % 64;
        tileY = floor((currentTile - 1) / 64);
        
        _c "#2. Parity Check: Only process a single checkerboard color set";
        _c "#This restricts your 4x3 room to a maximum of 6 tiles!";
        if (tileX + tileY) % 2 == 1 {
            
            _c "#3. Calculate camera-relative offset from the center of the tile";
            dx1 = (tileX + 0.5) - playerX;
            dy1 = (tileY + 0.5) - playerY;
            
            _c "#4. Transform to Camera Space (Yaw rotation only)";
            tx1 = dx1 * camCos - dy1 * camSin; 
            tz1 = dx1 * camSin + dy1 * camCos; 
            
            _c "#5. Near Plane Clipping Guard";
            if tz1 > 0.1 {
                 
                _c "#Perspective project center to screen horizontal X";
                sx1 = round((tx1 / tz1) * focalLength); 
                
                _c "#6. Frustum Boundary Check (padded with a rough tile radius)";
                if (sx1 + (180 / tz1)) >= -240 and (sx1 - (180 / tz1)) <= 240 {
                    add currentTile to frustrumFloorTiles;            
                }
            }
        }
        read_ptr += 1;
    }
}



proc process_room targetRoom {
    _c "#Process room geometry: transform vertices, assemble edges";
    _c "#Find where this room's data block begins";
    read_ptr = room_ptr[$targetRoom];
    
    _c "#Header extraction using 4-item stride [V, E, F, Ent]";
    v_len = rooms[read_ptr];
    e_len = rooms[read_ptr + 1];
    f_len = rooms[read_ptr + 2];
    ent_len = rooms[read_ptr + 3]; 
    
    _c "#Move pointer past the 4 header values directly to the Vertex IDs";
    read_ptr += 4; 

    _c "#==========================================================";
    _c "#--- PASS 1: VERTEX TRANSFORMATIONS (Vertex Shader) -------";
    _c "#==========================================================";
    repeat v_len {
        v_id = rooms[read_ptr];
        
        _c "#Stream World X/Y directly out of the Master Vertex Array";
        v_base = ((v_id - 1) * 2) + 1;
        dx1 = vertex[v_base] - playerX;
        dy1 = vertex[v_base + 1] - playerY;
        
        _c "#Transform World Space -> Camera Space (Rotation)";
        l_tx[v_id] = dx1 * camCos - dy1 * camSin;
        l_tz[v_id] = dx1 * camSin + dy1 * camCos;
        
        read_ptr += 1;
    }

    _c "#==========================================================";
    _c "#--- PASS 2: EDGE ASSEMBLY (Fragment/Geometry Setup) ------";
    _c "#==========================================================";
    repeat e_len {
        edge_id = rooms[read_ptr];
        e_base = ((edge_id - 1) * 6) + 1;
        
        tile_type = edges[e_base];
        v1_id     = edges[e_base + 1];
        v2_id     = edges[e_base + 2];

        is_visible = 0;

        if tile_type == 2 {
            _c "#--- DYNAMIC DOOR PATH ---";
            v1_ptr = ((v1_id - 1) * 2) + 1;
            v2_ptr = ((v2_id - 1) * 2) + 1;
            wx1 = vertex[v1_ptr]; wy1 = vertex[v1_ptr + 1];
            wx2 = vertex[v2_ptr]; wy2 = vertex[v2_ptr + 1];

            dx1 = wx1 - playerX; dy1 = wy1 - playerY;
            dx2 = wx2 - playerX; dy2 = wy2 - playerY;

            edgeTileIdx = floor((wx1 + wx2) / 2) + floor((wy1 + wy2) / 2) * 64 + 1;
            if edgeTileIdx == activeDoorIndex {
                dx1 = dx1 + (wx2 - wx1) * doorOpenRatio;
                dy1 = dy1 + (wy2 - wy1) * doorOpenRatio;
            }

            tx1 = dx1 * camCos - dy1 * camSin;
            tz1 = dx1 * camSin + dy1 * camCos;
            tx2 = dx2 * camCos - dy2 * camSin;
            tz2 = dx2 * camSin + dy2 * camCos;
            
            is_visible = 1; 
        } else {
            _c "#--- STATIC WALL FAST PATH ---";
            tx1 = l_tx[v1_id]; tz1 = l_tz[v1_id];
            tx2 = l_tx[v2_id]; tz2 = l_tz[v2_id];

            _c "#Standard Back-Face Culling (Determinant check)";
            if (tx1 * tz2) - (tx2 * tz1) < 0 {
                is_visible = 1;
            }
        }

        _c "#--- CLIPPING AND PROJECTION ---";
        if is_visible == 1 {
            if tz1 < 0.1 and tz2 < 0.1 {
                is_visible = 0;
            } elif tz1 < 0.1 {
                t_clip = (0.1 - tz1) / (tz2 - tz1);
                tx1 = tx1 + (t_clip * (tx2 - tx1));
                tz1 = 0.1;
            } elif tz2 < 0.1 {
                t_clip = (0.1 - tz2) / (tz1 - tz2);
                tx2 = tx2 + (t_clip * (tx1 - tx2));
                tz2 = 0.1;
            }

            if is_visible == 1 {
                if tz1 > furthest_wall_depth { furthest_wall_depth = tz1; }
                if tz2 > furthest_wall_depth { furthest_wall_depth = tz2; }
                
                rx1 = (tx1 / tz1) * focalLength;
                rx2 = (tx2 / tz2) * focalLength;

                l_rx1[edge_id] = rx1; l_tz1[edge_id] = tz1;
                l_rx2[edge_id] = rx2; l_tz2[edge_id] = tz2;
                
                if not (rx1 > 240 or rx2 < -240) {
                    if rx1 < -240 {
                        t_clip = (-240 - rx1) / (rx2 - rx1);
                        tz1 = 1/(1/tz1 + t_clip * (1/tz2 - 1/tz1));
                        rx1 = -240;
                    }
                    if rx2 > 240 {
                        t_clip = (240 - rx1) / (rx2 - rx1);
                        tz2 = 1/(1/tz1 + t_clip * (1/tz2 - 1/tz1));
                        rx2 = 240;
                    }

                    add ((tz1 + tz2) / 2) to edgeSort;
                    add edge_id to edgeSort;                    
                }
            }
        }
        read_ptr += 1;
    }
    _c "#==========================================================";
    _c "#--- PASS 3: ENTITY HARVESTING & PARALLAX SETUP -----------";
    _c "#==========================================================";    
    
    if ent_len > 0 {
        _c "# read_ptr is already past the header.";
        _c "# Jump pointer past V, E, F lists and Bounding Box (4) to hit Entities";
        ent_ptr = room_ptr[$targetRoom] + 4 + v_len + e_len + f_len + 4;
        
        repeat ent_len {
            t_idx = rooms[ent_ptr];
            ent_type = rooms[ent_ptr + 1];
            
            _c "# 1. Unpack 1D index to Grid Coordinates";
            tileX = (t_idx - 1) % 64;
            tileY = floor((t_idx - 1) / 64);
            
            _c "# 2. Calculate offset to the dead-center of the tile";
            dxC = (tileX + 0.5) - playerX;
            dyC = (tileY + 0.5) - playerY;
            
            _c "# 3. Transform Center Point to Camera Space";
            txC = dxC * camCos - dyC * camSin;
            tzC = dxC * camSin + dyC * camCos;
            
            _c "# 4. Near Plane Clipping Guard";
            if tzC > 0.1 {
                
                _c "# Push 8-stride tuple: [Type, zAvg, x1, z1, x2, z2, roomId, drawIdx]";
                _c "# x1/x2 bounds represent a 1-unit wide camera-facing billboard";
                add ent_type to frameEntity;
                add tzC to frameEntity;        # zAvg (Used for sorting)
                add txC - 0.5 to frameEntity;  # x1 (Left edge)
                add tzC to frameEntity;        # z1
                add txC + 0.5 to frameEntity;  # x2 (Right edge)
                add tzC to frameEntity;        # z2
                add $targetRoom to frameEntity;# roomId
                add 0 to frameEntity;          # drawCommand_idx_start

            }
            
            _c "# Advance pointer by 2 for the [tile_idx, type] stride";
            ent_ptr += 2;
        }
    }
}

proc movePlayer moveStep {
    _c "#MOVEMENT COLLISION & DOOR LOGIC";
    newX = playerX + sin(playerDir) * $moveStep;
    newY = playerY + cos(playerDir) * $moveStep;
    tileX = map[floor(newX + sin(playerDir) * ($moveStep * 5)) + floor(playerY) * 64 + 1];
    tileY = map[floor(playerX) + floor(newY + cos(playerDir) * ($moveStep * 5)) * 64 + 1];
    
    if tileX == 0 or (tileX == 2 and doorOpenRatio > 0.8) {
        playerX = newX;
    }
    if tileY == 0 or (tileY == 2 and doorOpenRatio > 0.8) {
        playerY = newY;
    }
}

proc updateDoor {
    _c "#Update door open/close state based on player position";
    
    currentTile = floor(playerX) + floor(playerY) * 64 + 1;
    lookTile = floor(playerX + sin(playerDir)) + floor(playerY + cos(playerDir)) * 64 + 1;
    
    if map[currentTile] == 2 {
        activeDoorIndex = currentTile;
        if doorOpenRatio < 1 { doorOpenRatio += 0.1; }
        doorTimer = 30;
    }
    elif map[lookTile] == 2 {
        if lookTile != activeDoorIndex and doorOpenRatio > 0 {
            doorOpenRatio = 0;
            activeDoorIndex = 0;
        }
        else {
            activeDoorIndex = lookTile;
            if doorOpenRatio < 1 { doorOpenRatio += 0.1; }
            doorTimer = 30;
        }
    }
    else {
        if doorOpenRatio > 0 {
            if doorTimer > 0 {
                doorTimer -= 1;
            } else {
                doorOpenRatio -= 0.1;
                if doorOpenRatio <= 0 {
                    doorOpenRatio = 0;
                    activeDoorIndex = 0;
                }
            }
        } else {
            activeDoorIndex = 0;
            doorOpenRatio = 0;
        }
    }
}

proc getRoomBB targetRoom {
    _c "#BOUNDING BOX EXTRACTION";
    delete roomBB;
    
    _c "#1. Find where this room's data block begins";
    read_ptr = room_ptr[$targetRoom];
    read_ptr = read_ptr + 4 + rooms[read_ptr] + rooms[read_ptr + 1] + rooms[read_ptr + 2];
    
    _c "#4. Stream the 4 bounding box values (minX, minY, maxX, maxY) into the list";
    repeat 4 {
        add rooms[read_ptr] to roomBB;
        read_ptr += 1;
    }
    harvest_floor_tiles $targetRoom;
}

proc insertWall{
    if hideWalls==0{
        _c "#Add Wall to the Draw Queue with texture selection";

        _c "# 1. Extract geometry from edges and vertex arrays";
        list_idx = ((c_id - 1) * 6) + 1;
        edge_v1 = edges[list_idx + 1];
        edge_v2 = edges[list_idx + 2];
        
        v1_ptr = ((edge_v1 - 1) * 2) + 1;
        v2_ptr = ((edge_v2 - 1) * 2) + 1;
        
        wx1 = vertex[v1_ptr];
        wy1 = vertex[v1_ptr + 1];
        wx2 = vertex[v2_ptr];
        wy2 = vertex[v2_ptr + 1];
        if edge2Room[c_id] > 0{
            roomId= edge2Room[c_id];
        }
        #else {roomId=}
        edgeRoomTexture=roomTexture[roomId];

        _c "# 2. Compute isDoorFrame boolean";
        wall_len = sqrt(((wx2 - wx1) * (wx2 - wx1)) + ((wy2 - wy1) * (wy2 - wy1)));
        
        #isDoorFrame = 0;
        if wall_len <= 0.51 {
            c_type = 3;
        } else {
            _c "# Check if vertices fall on non-integer map coordinates";
            if (wx1 != round(wx1)) or (wy1 != round(wy1)) or (wx2 != round(wx2)) or (wy2 != round(wy2)) {
                c_type = 3;
            }
        }

        emit_wall start_vis_x, new_tz1, end_vis_x, new_tz2, c_face, c_id, c_type, roomTextureId, roomId ;
        _c "#Add Wall to the Frame Edge for Wall Shader, if this edge is not a door frame"; 
        if roomId > 0 {
            populate_frameEdge c_id, edgeRoomTexture;
        }
        else{
            walls[length(walls)] = -1;
        }
    }
}

proc populate_frameEdge c_id,  c_roomTextureId {

    _c "# 4. Pack the frameEdge buffer, calculating transforms inline";
    add $c_id to frameEdge;
    add edges[list_idx] to frameEdge;
    add edges[list_idx + 3] to frameEdge;
    add $c_roomTextureId to frameEdge;
    add (c_type==3) to frameEdge;
    add wx1 to frameEdge;
    add wy1 to frameEdge;
    add wx2 to frameEdge;
    add wy2 to frameEdge;
    
    _c "# Inline camera-space transforms (tx1, tz1, tx2, tz2)";
    add (wx1 - playerX) * camCos - (wy1 - playerY) * camSin to frameEdge;
    add (wx1 - playerX) * camSin + (wy1 - playerY) * camCos to frameEdge;
    add (wx2 - playerX) * camCos - (wy2 - playerY) * camSin to frameEdge;
    add (wx2 - playerX) * camSin + (wy2 - playerY) * camCos to frameEdge;
    
    add 120 to frameEdge;
    add -120 to frameEdge;

    #edge_id     
    #edge_type   
    #edge_num_tiles 
    #textureId   
    #isDoorFrame 
    #wx1         
    #wy1         
    #wx2         
    #wy2         
    #tx1         
    #tz1         
    #tx2         
    #tz2         
    #ceil_z      
    #floor_z     
}


proc emit_wall sx1, sz1, sx2, sz2, face, edge, e_type, textureId, roomId {
    _c "#Push 11-element wall stride to walls list";
    add $sx1 to walls;
    add $sz1 to walls;
    add $sx2 to walls;
    add $sz2 to walls;
    add $face to walls;
    add $e_type to walls;
    add $edge to walls;
    add -1 to walls;
    add 120 to walls;
    add -120 to walls;
    add length(frameEdge) + 1 to walls;
    add $textureId to walls;
    add $roomId to walls;
}

proc init {
    _c "#39.5;";
    playerX = 39.5;#55.1;
    _c "#50.5;";
    playerY = 50.5;#37.5;
    _c "#-90;";
    playerDir = -90;#990;
    
    switch_costume "blank";
    _c "#Max size bypass";
    set_size 1/0;
    delete span_buffer;
    delete l_rx1;
    delete l_rx2;
    delete l_tz1;
    delete l_tz2;
    repeat 481 { add 0 to span_buffer; }    
   
    delete l_tx; delete l_tz;
    _c "--- FIX 1: Safely allocate Vertex Shader Caches ---" ;
    repeat (length vertex)/2 {
        add 0 to l_tx;
        add 0 to l_tz;
    }

    _c "#--- FIX 2: Safely allocate Edge/Wall Caches past any ID gaps ---";
    delete l_rx1; delete l_tz1; delete l_rx2; delete l_tz2;
    repeat (length edges)/6 {
        add 0 to l_rx1;
        add 0 to l_tz1;
        add 0 to l_rx2; 
        add 0 to l_tz2;
    }
    frameCount = 1;

}

proc  _c comment {}