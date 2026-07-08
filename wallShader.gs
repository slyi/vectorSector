costumes "assets/576aeb89.svg" as "costume1";

# =================================================================
# --- SPRITE VARIABLES (wallShader.gs) --------------------------
# =================================================================

# Local copies of vectorRooms engine state

var focalLength;

# Wall data extraction variables
var wallsLength;
var wall_sx1;
var wall_sz1;
var wall_sx2;
var wall_sz2;
var wall_face;
var wall_type;
var wall_edge;
var wall_drawIdx;
var wall_ceiling;
var wall_floor;
var wall_frame_idx;

# frameEdge extraction variables (14-element stride)
var edge_id;
var edge_type;
var edge_num_tiles;
var textureId;
var isDoorFrame;
var wx1;
var wy1;
var wx2;
var wy2;
var tx1;
var tz1;
var tx2;
var tz2;
var ceil_z;
var floor_z;

list poly_x = [];
list poly_y = [];
list next_poly_x= [];
list next_poly_y= [];

# =================================================================
# --- BROADCAST RECEIVER ------------------------------------------
# =================================================================

on "wallShader" {
    _c "# Proceed to process the walls list and call pattern procs here...";
    process_walls;
}


proc process_walls {
    _c "# Main loop to texture walls into drawCommands";
    shaderTime = days_since_2000() * 86400000;
    delete drawCommands;
    focalLength = "vectorRooms"."focalLength";
    wall_idx = 1;
    wallsLength = length(walls)/12;
    
    repeat wallsLength {
        walls[wall_idx + 7] = length(drawCommands) + 1;
        read_wall_data;       
        
        if wall_frame_idx > 0 {
            read_frameEdge_data;
            if textureId == 1 {
                greekKeyWallPattern;
            }
            elif textureId == 2 {
                offset5x5BrickWallPattern;
            }
            elif textureId == 3 {
                quoinVLineWallPattern;
            }
            elif textureId == 4 {
                octagonWallPattern;
            }
            else {               
                add "EoL" to drawCommands;
                add "EoW" to drawCommands;
            }
        
        }
          
        wall_idx += 12;
    }
    shaderTime = round(days_since_2000() * 86400000 - shaderTime);
}

proc read_wall_data {
    _c "# Read wall data from last walls entry into shared vars";
    
    wall_sx1     = walls[wall_idx];
    wall_sz1     = walls[wall_idx + 1];
    wall_sx2     = walls[wall_idx + 2];
    wall_sz2     = walls[wall_idx + 3];
    wall_face    = walls[wall_idx + 4];
    wall_type    = walls[wall_idx + 5];
    wall_edge    = walls[wall_idx + 6];
    wall_drawIdx = walls[wall_idx + 7];
    wall_ceiling = walls[wall_idx + 8];
    wall_floor   = walls[wall_idx + 9];
    wall_frame_idx = walls[wall_idx + 10]; 
    wall_roomTexture = walls[wall_idx + 11]; 
}

proc read_frameEdge_data {
    _c "# Extract 15 geometric and surface elements from the static buffer";
    edge_id     = frameEdge[wall_frame_idx];
    edge_type   = frameEdge[wall_frame_idx + 1];
    edge_num_tiles = frameEdge[wall_frame_idx + 2];
    textureId   = frameEdge[wall_frame_idx + 3];
    isDoorFrame = frameEdge[wall_frame_idx + 4];
    wx1         = frameEdge[wall_frame_idx + 5];
    wy1         = frameEdge[wall_frame_idx + 6];
    wx2         = frameEdge[wall_frame_idx + 7];
    wy2         = frameEdge[wall_frame_idx + 8];
    tx1         = frameEdge[wall_frame_idx + 9];
    tz1         = frameEdge[wall_frame_idx + 10];
    tx2         = frameEdge[wall_frame_idx + 11];
    tz2         = frameEdge[wall_frame_idx + 12];
    ceil_z      = frameEdge[wall_frame_idx + 13];
    floor_z     = frameEdge[wall_frame_idx + 14];
}

proc offset5x5BrickWallPattern {
    _c "#--- offset5x5BrickWallPattern ---";
    
    numTiles = edge_num_tiles;
    
    _c "#Early exit for door frames or dynamic doors";
    if wall_type != 1 {
        add "EoL" to drawCommands;
        add "EoW" to drawCommands;
        stop_this_script;
    }

    _c "# PHASE 1: Verticals (Offset by parity)";
    if (numTiles * 5) - 1 > 0 {
        
        totalSteps = numTiles * 5;
        current_step = 1;
        repeat totalSteps - 1 {
            _c "# Pass the costume based on odd/even step";
            stamp_id = (current_step % 2) + 3; 
            emit_vertical_element (current_step / totalSteps), stamp_id;
            current_step += 1;
        }
        add "EoL" to drawCommands;
    }
    
    _c "#PHASE 2: PEN (Horizontal Mortar Lines)";
    row = 1;
    repeat 4 {
        emit_continuous_hline (120 - (row * 240 / 5));
        row += 1;
    }
   
    add "EoW" to drawCommands;
}

proc quoinVLineWallPattern {
    _c "************** quoinVLineWallPattern **************";

    numTiles = edge_num_tiles;
   

    _c "Early exit for door frames or dynamic doors";
    if wall_type != 1 {
        add "EoL" to drawCommands;
        add "EoW" to drawCommands;
        stop_this_script;
    }

    if isDoorFrame == 1 { 
        totalSteps = 3; 
    } else { 
        totalSteps = numTiles;
    }

    _c "# ==========================================";
    _c "# PHASE 1: UNIFIED VERTICAL PASS";
    _c "# ==========================================";
    
    if numTiles >= 2 {
        _c "# Swap quoin stamps for interlocking corners (0 vs 1 alignment)";
        if wall_face == 0 {
            q_stamp_A = "2dash";
            q_stamp_B = "3dash";
        } else {
            q_stamp_A = "3dash";
            q_stamp_B = "2dash";
        }

        _c "# 1. Left Quoin Stamps (1/3 and 2/3 marks)";
        emit_vertical_element (1 / (totalSteps * 3)), q_stamp_A;
        emit_vertical_element (2 / (totalSteps * 3)), q_stamp_B;
    }
    
    _c "# 2. V-Lines at ALL integer tile boundaries";
    if totalSteps > 0 {
        current_step = 0;
        repeat totalSteps + 1 {
            emit_vertical_element (current_step / totalSteps), "1dash";
            current_step += 1;
        }
    }
    
    if numTiles >= 2 {
        _c "# 3. Right Quoin Stamps (N-2/3 and N-1/3 marks)";
        emit_vertical_element (((totalSteps * 3) - 2) / (totalSteps * 3)), q_stamp_B;
        emit_vertical_element (((totalSteps * 3) - 1) / (totalSteps * 3)), q_stamp_A;
    }
   
    add "EoL" to drawCommands;

            
    _c "# Get the costume names for the left and right quoin stamps";
    costume_start = drawCommands[wall_drawIdx + 2];
    costume_end = drawCommands[length(drawCommands) - 1];
    
    _c "# ==========================================";
    _c "# PHASE 2: H-LINES (8-Line Method with Fast-Fail)";
    _c "# ==========================================";
         
    if numTiles >= 2 {
        _c "# Calculate the t-values for the inner edges of the quoins";
        lq_t = 2 / (totalSteps * 3);
        rq_t = ((totalSteps - 1) * 3 + 1) / (totalSteps * 3);
        
        _c "# Left Quoin: Draw 4 lines starting at row 1, using a 5-row grid";
        if (costume_start != "1dash")  {
            emit_stacked_hlines 0, lq_t, 1, 4, 5;
        }
        
        _c "# Right Quoin: Draw 4 lines starting at row 1, using a 5-row grid";
        if (costume_end != "1dash"){
        emit_stacked_hlines rq_t, 1, 1, 4, 5;    
        }
    }

    add "EoW" to drawCommands;
}

proc greekKeyWallPattern {
    _c "************** greekKeyWallPattern **************";

    numTiles = edge_num_tiles;
    
    costume_start ="";
    costume_end = "";

    _c " Early exit for door frames or dynamic doors";
    if wall_type != 1 {
        add "EoL" to drawCommands;
        add "EoW" to drawCommands;
        stop_this_script;
    }

    _c "//Set up loop configurations based on segment type";

    if isDoorFrame == 1 { 
        loopCount = 2; 
        totalSteps = 3; 
    } else { 
        loopCount = numTiles; 
        totalSteps = numTiles;
    }

    # PHASE 1: Vertical lines (stamps)
    gk_tile = 0;

    # 1. Define total segments based on the 9x9 grid
    num_steps = numTiles * 9;

    # 2. Left Edge: Pad 1 step in (index 1 and 2)
    left_idx_A = 1;
    left_idx_B = 2;
    oddTiles = (numTiles % 2) ;
    # 3. Right Edge: Pad 2 steps if even, 1 step if odd
    if oddTiles == 0 {
        right_pad = 2;
    } else {
        right_pad = 1;
    }
    
    right_idx_B = num_steps - right_pad - 1;
    right_idx_A = num_steps - right_pad;

    calc_visible_grid_range num_steps;
    _c "# Clamp the physical grid range to respect the pattern's right padding";
    if end_step > right_idx_A {
        end_step = right_idx_A;
    }

    _c "# 4. Loop through the active range";
    first_visible_step = -1;
    current_step = 1;
    _c "# Capture list length before attempting to draw";
    last_list_len = length(drawCommands);
    ground_truth_start = -1;
    ground_truth_end   = -1;
    current_step = start_step; 
    repeat (end_step - start_step + 1) {
        
        _c "# Assign the correct costume for the current step";
        if current_step == left_idx_A {
            stamp_costume = "greekKeyA";
        } elif current_step == left_idx_B {
            stamp_costume = "greekKeyB";
        } elif current_step == right_idx_B {
            stamp_costume = "greekKeyB";
        } elif current_step == right_idx_A {
            stamp_costume = "greekKeyA";
        } else {
            stamp_costume = "greekKeyC";
        }

        _c "# 5. Let the helper handle 3D projection and clipping";
        t = current_step / num_steps;
        emit_vertical_element t, stamp_costume;

        _c "# If the list grew, the element survived clipping and is on-screen";
        if length(drawCommands) > last_list_len {
            if ground_truth_start == -1 {
                ground_truth_start = current_step; # Locks in the very first visible step
            }
            ground_truth_end = current_step;       # Constantly updates to the most recent visible step
            last_list_len = length(drawCommands);  # Reset our length anchor
        }
        
        current_step += 1;
    }

        _c "# Anchor the parity to the true world-space grid index";
    if ground_truth_start != -1 {
        parity = (ground_truth_start % 2);
    } else {
        parity = 0;
    }
    
    vline_end_idx = length(drawCommands)-2;
    add "EoL" to drawCommands;
    
    _c "# ==========================================";
    _c "# PHASE 2: DASHED HORIZONTAL ROWS";
    _c "# ==========================================";
    
_c "# Determine precise logical boundaries for the dashes";
    if ground_truth_start > left_idx_A {
        dash_sx_start = wall_sx1;
        dash_sz_start = wall_sz1;
    } else {
        dash_sx_start = drawCommands[wall_drawIdx];
        dash_sz_start = drawCommands[wall_drawIdx + 1];
    }

    _c "# Check against right_idx_A instead of num_steps";
    if ground_truth_end < right_idx_A {
        dash_sx_end = wall_sx2;
        dash_sz_end = wall_sz2;
    } else {
        dash_sx_end = drawCommands[vline_end_idx];
        dash_sz_end = drawCommands[vline_end_idx + 1];
    }

    if vline_end_idx >= wall_drawIdx {
        parity = 1 - parity;
        # --- Row 1 (Top border dashes: odd columns) ---
        emit_dashed_row (120 - (1 * 240 / 9)), dash_sx_start, dash_sz_start, dash_sx_end, dash_sz_end, wall_drawIdx, vline_end_idx, parity;
        # --- Row 8 (Bottom border dashes: odd columns) ---
        emit_dashed_row (120 - (8 * 240 / 9)), dash_sx_start, dash_sz_start, dash_sx_end, dash_sz_end, wall_drawIdx, vline_end_idx, parity;
        
        parity = 1 - parity;
        # --- Row 2 (Top border dashes: even columns) ---
        emit_dashed_row (120 - (2 * 240 / 9)), dash_sx_start, dash_sz_start, dash_sx_end, dash_sz_end, wall_drawIdx, vline_end_idx, parity;
        # --- Row 7 (Bottom border dashes: even columns) ---
        emit_dashed_row (120 - (7 * 240 / 9)), dash_sx_start, dash_sz_start, dash_sx_end, dash_sz_end, wall_drawIdx, vline_end_idx, parity;
    }

    _c "# PHASE 3: Missing Vertical Edge Connectors (Rows 2 through 7)";
    _c "# Calculate the absolute t-values using the indices defined in Phase 1";
    left_start_t = left_idx_A / num_steps;
    left_end_t = left_idx_B / num_steps;
    
    right_start_t = right_idx_B / num_steps;
    right_end_t = right_idx_A / num_steps;

    _c "# Far-Left Edge Connector";
    _c "# Draws 6 lines starting at row 2, on a 9-row grid";
    _c "# Far-Left Edge Connector (Grid Steps: left_idx_A to left_idx_B)";
    emit_stacked_logical_hlines left_idx_A, left_idx_B, num_steps, 2, 6, 9;

    _c "# Far-Right Edge Connector (Grid Steps: right_idx_B to right_idx_A)";
    emit_stacked_logical_hlines right_idx_B, right_idx_A, num_steps, 2, 6, 9;
    add "EoW" to drawCommands;
}

proc octagonWallPattern {
    _c "************** octagonWallPattern **************";


    numTiles = edge_num_tiles;
    

    _c " Early exit for door frames or dynamic doors";
    if wall_type != 1 {
        add "EoL" to drawCommands;
        add "EoW" to drawCommands;
        stop_this_script;
    }

    _c "# ==========================================";
    _c "# PHASE 1: Visibility Analysis & Anchors";
    _c "# ==========================================";
    current_tile = 0;
    
    repeat numTiles {
        check_tile_visibility;
        
        if tile_vis != "blank_hidden" {
            _c "# Determine specific costume IDs for each vline";
            costume2 = "blank";
            if sx2 < wall_sx1 { costume2 = "blank_leftClipped"; }
            
            costume8 = "blank";
            if sx8 > wall_sx2 { costume8 = "blank_rightClipped"; }

            _c "# Store as 3 items per vline to maintain the +3 array stride";
            add sx2 to drawCommands; add tz2_3d to drawCommands; add costume2 to drawCommands;
            add sx8 to drawCommands; add tz8_3d to drawCommands; add costume8 to drawCommands;
        }
        current_tile += 1;
    }
    
    vline_end_idx = length(drawCommands)-2;
    add "EoL" to drawCommands;

    if vline_end_idx > wall_drawIdx {
        _c "# Extract outer bounds from the first and last valid vlines";
        safe_sx_start = drawCommands[wall_drawIdx];
        safe_sz_start = drawCommands[wall_drawIdx + 1];
        costume_start = drawCommands[wall_drawIdx + 2];
        
        safe_sx_end   = drawCommands[vline_end_idx];
        safe_sz_end   = drawCommands[vline_end_idx + 1];
        costume_end   = drawCommands[vline_end_idx + 2];

        _c "# ==========================================";
        _c "# PHASE 2: The Octagon Shell";
        _c "# ==========================================";
        wyTop = 120 - (1 * 240 / 9);
        wyBot = 120 - (8 * 240 / 9);
        
        readIdx = wall_drawIdx;
        
        _c "# Read stride is exactly 6 (two 3-item vlines)";
        until readIdx >= vline_end_idx {
            sx2 = drawCommands[readIdx];     sz2 = drawCommands[readIdx + 1];
            sx8 = drawCommands[readIdx + 3]; sz8 = drawCommands[readIdx + 4];
            
            yTL = wyTop / sz2; yBL = wyBot / sz2;
            yTR = wyTop / sz8; yBR = wyBot / sz8;
            
            dx = sx8 - sx2; 
            dyT = yTR - yTL; dyB = yBR - yBL; 
            dyL = yBL - yTL; dyR = yBR - yTR;

            _c "# Slice against span buffers and emit to drawCommands automatically";
            _c "# Branching optimization path based on metadata costume flags";
            if costume_start == "blank" and costume_end == "blank" {
                add "gotoWalker" to drawCommands;
                _c "# V8: Left-Top";
                add sx2 to drawCommands; add yTL + dyL/6 to drawCommands; 
                add sx2 to drawCommands; add yTL + dyL*5/6 to drawCommands;
                _c "# V6: Bottom-Left";
                add sx2 + dx/6 to drawCommands; add yBL + dyB/6 to drawCommands; 
                add sx2 + dx*5/6 to drawCommands; add yBL + dyB*5/6 to drawCommands;
                _c "# V4: Right-Bottom";
                add sx8 to drawCommands; add yTR + dyR*5/6 to drawCommands; 
                add sx8 to drawCommands; add yTR + dyR/6 to drawCommands;
                _c "# V2: Top-Right";
                add sx2 + dx*5/6 to drawCommands; add yTL + dyT*5/6 to drawCommands; 
                add sx2 + dx/6 to drawCommands; add yTL + dyT/6 to drawCommands;
                add sx2 to drawCommands; add yTL + dyL/6 to drawCommands; 
                add "EoL" to drawCommands;
                
            } else {
                _c "# Load raw vertices strictly CCW (Top-Left -> Bottom-Left -> Right -> Top-Right)";
                delete poly_x; delete poly_y;
                
                add sx2 to poly_x; add yTL + dyL/6 to poly_y;            _c "# V8: Left-Top";
                add sx2 to poly_x; add yTL + dyL*5/6 to poly_y;          _c "# V7: Left-Bottom";
                add sx2 + dx/6 to poly_x; add yBL + dyB/6 to poly_y;     _c "# V6: Bottom-Left";
                add sx2 + dx*5/6 to poly_x; add yBL + dyB*5/6 to poly_y; _c "# V5: Bottom-Right";
                add sx8 to poly_x; add yTR + dyR*5/6 to poly_y;          _c "# V4: Right-Bottom";
                add sx8 to poly_x; add yTR + dyR/6 to poly_y;            _c "# V3: Right-Top";
                add sx2 + dx*5/6 to poly_x; add yTL + dyT*5/6 to poly_y; _c "# V2: Top-Right";
                add sx2 + dx/6 to poly_x; add yTL + dyT/6 to poly_y;     _c "# V1: Top-Left";
                emit_clipped_polygon;
            }
            
            readIdx += 6;
        }
        _c "# ==========================================";
        _c "# PHASE 2: Dashed Inner Rows";
        _c "# ==========================================";
        
        _c "# Clamp X coordinates to the wall boundaries if flagged";
        if safe_sx_start < wall_sx1  {  
            safe_sx_start = wall_sx1; 
            safe_sz_start = wall_sz1; 
            drawCommands[wall_drawIdx]=wall_sx1;
            drawCommands[wall_drawIdx + 1]=wall_sz1; 
        }
        if safe_sx_end > wall_sx2 {
            safe_sx_end = wall_sx2; 
            safe_sz_end = wall_sz2; 
            drawCommands[vline_end_idx]=wall_sx2;
            drawCommands[vline_end_idx + 1]=wall_sz2;
        }
        _c "# Call dashed line once per row across the guaranteed safe bounds";
        emit_dashed_row (120 - (4 * 240 / 9)), safe_sx_start, safe_sz_start, safe_sx_end, safe_sz_end, wall_drawIdx, vline_end_idx, 0;
        emit_dashed_row (120 - (5 * 240 / 9)), safe_sx_start, safe_sz_start, safe_sx_end, safe_sz_end, wall_drawIdx, vline_end_idx, 0;


    }
    add "EoW" to drawCommands;
}

proc emit_stamp {
    _c "#Push proj_x, proj_z, stamp_costume to drawCommands";
    add proj_x to drawCommands;
    add proj_z to drawCommands;
    add stamp_costume to drawCommands;
}

proc emit_logical_hline step_a, step_b, total_steps, world_y {
    _c "# 1. Fast Integer Clamping against Ground Truth";
    safe_a = $step_a;
    safe_b = $step_b;
    
    if safe_a < ground_truth_start { safe_a = ground_truth_start; }
    if safe_b > ground_truth_end   { safe_b = ground_truth_end; }
    
    _c "# 2. Fast-Fail if the line is completely off-screen or zero-length";
    if safe_a >= safe_b {
        stop_this_script;
    }
    
    _c "# 3. Calculate safe T-values";
    t_start = safe_a / $total_steps;
    t_end   = safe_b / $total_steps;
    
    _c "# 4. Calculate Z-depths (Assigned to variables because they are used 3 times each)";
    sz_start = tz1 + t_start * (tz2 - tz1);
    sz_end   = tz1 + t_end * (tz2 - tz1);
    
    _c "# 5. Inline X-projections and Emit instantly";
    emit_line (((tx1 + t_start * (tx2 - tx1)) / sz_start) * focalLength), sz_start, ($world_y / sz_start), (((tx1 + t_end * (tx2 - tx1)) / sz_end) * focalLength), sz_end, ($world_y / sz_end);
}

proc emit_stacked_logical_hlines step_a, step_b, total_steps, row_start, row_count, grid_divisions {
    current_row = $row_start;
    repeat $row_count {
        world_y = 120 - (current_row * 240 / $grid_divisions);
        emit_logical_hline $step_a, $step_b, $total_steps, world_y;
        current_row += 1;
    }
}

proc calc_visible_grid_range total_steps {
    _c "# --- Reverse Perspective Projection ---";
    
    _c "# Calculate t-value for left screen clip (wall_sx1)";
    num1 = (tx1 * focalLength) - (wall_sx1 * tz1);
    den1 = (wall_sx1 * (tz2 - tz1)) - (focalLength * (tx2 - tx1));
    if den1 == 0 { t1 = 0; } else { t1 = num1 / den1; }
    
    _c "# Calculate t-value for right screen clip (wall_sx2)";
    num2 = (tx1 * focalLength) - (wall_sx2 * tz1);
    den2 = (wall_sx2 * (tz2 - tz1)) - (focalLength * (tx2 - tx1));
    if den2 == 0 { t2 = 1; } else { t2 = num2 / den2; }
    
    _c "# Order t-values safely (handles near-plane camera crossing inversions)";
    if t1 < t2 {
        t_start = t1;
        t_end = t2;
    } else {
        t_start = t2;
        t_end = t1;
    }
    
    _c "# Convert t (0.0 to 1.0) into discrete grid steps";
    _c "# Use round(+/- 0.5) to emulate floor() and ceiling()";
    start_step = round((t_start * $total_steps) - 0.5);
    end_step   = round((t_end * $total_steps) + 0.5);
    
    _c "# Pad by 1 to ensure boundary edge-stamps aren't preemptively clipped";
    start_step -= 1;
    end_step += 1;
    
    _c "# Clamp strictly to the physical limits of the wall";
    if start_step < 1 { start_step = 1; }
    if end_step > $total_steps { end_step = $total_steps; }
}

proc emit_line x1, z1, y1, x2, z2, y2 {
    _c "#Push 6-element line (x1,z1,y1,x2,z2,y2) to drawCommands";
    add $x1 to drawCommands;
    add $z1 to drawCommands;
    add $y1 to drawCommands;
    add $x2 to drawCommands;
    add $z2 to drawCommands;
    add $y2 to drawCommands;
}

proc emit_vertical_element target_t, costume_id {
    proj_z = tz1 + $target_t * (tz2 - tz1);
    
    if proj_z > 0.1 {
        tx = tx1 + $target_t * (tx2 - tx1);
        proj_x = (tx / proj_z) * focalLength;
        
        # Strict wall-boundary visibility check
        if (proj_x >= wall_sx1 - 0.5) and (proj_x <= wall_sx2 + 0.5) {
            stamp_costume = $costume_id;
            emit_stamp;
        }
    }
}

proc emit_continuous_hline world_y {
    _c "# Draws a solid line across the entire visible span of the wall";
    emit_line wall_sx1, wall_sz1, ($world_y / wall_sz1) , wall_sx2, wall_sz2, ($world_y / wall_sz2) ;
}

proc emit_dashed_row world_y, clipped_sx_start, clipped_sz_start, clipped_sx_end, clipped_sz_end, vline_start_idx, vline_end_idx, parity {

    dash_sy_start = $world_y / $clipped_sz_start;
    dash_sy_end = $world_y / $clipped_sz_end;

    dash_dy = dash_sy_end - dash_sy_start;
    dash_dx = $clipped_sx_end - $clipped_sx_start;
    dash_dir = atan(dash_dx / dash_dy) + (180 * (dash_dy < 0)) ;
    sinDir = sin(dash_dir);
    
    add "dash_line" to drawCommands;
    add $clipped_sx_start to drawCommands;
    add dash_sy_start to drawCommands;
    add dash_dir to drawCommands;
    add $parity to drawCommands;
    
    drawLengthBefore = length(drawCommands);
    current_x = $clipped_sx_start;
    current_idx = $vline_start_idx;
    
    _c "# Loop through EVERY visible vline generated in Phase 1";
    if $vline_end_idx >= $vline_start_idx {
        num_vlines = (($vline_end_idx - $vline_start_idx) / 3) + 1;
        
        repeat num_vlines {
            target_x = drawCommands[current_idx];
            dist = (target_x - current_x) / sinDir;
            
            _c "# If dist is 0 (first vline perfectly matches screen edge), push 0 to keep parity synced";
            if dist >= 0 {
                add dist to drawCommands;
                current_x = target_x;
            }
            current_idx += 3;
        }
    }
    
    _c "# Final segment: Connect the last vline cleanly to the right boundary";
    if current_x < $clipped_sx_end - 0.01 {
        add ($clipped_sx_end - current_x) / sinDir to drawCommands;
    }
    
    _c "# Trailing alignment marker for renderFrame.gs parser";
    if (length(drawCommands) - drawLengthBefore) % 2 == 1 {
        add 0 to drawCommands;
    }
    add "EoL" to drawCommands;
}

proc emit_partial_hline t_start, t_end, world_y {
    _c "# 1. Project Start";
    sz_start = tz1 + $t_start * (tz2 - tz1);
    sx_start = ((tx1 + $t_start * (tx2 - tx1)) / sz_start) * focalLength;
    
    _c "# 2. Project End";
    sz_end = tz1 + $t_end * (tz2 - tz1);
    sx_end = ((tx1 + $t_end * (tx2 - tx1)) / sz_end) * focalLength;
    
    _c "# 3. Span Buffer Fast-Fails & Clamps";
    if sx_end < wall_sx1 or sx_start > wall_sx2 { stop_this_script; }
    
    if sx_start < wall_sx1 { sx_start = wall_sx1; sz_start = wall_sz1; }
    if sx_end > wall_sx2 { sx_end = wall_sx2; sz_end = wall_sz2; }
    
    emit_line sx_start, sz_start, ($world_y / sz_start), sx_end, sz_end, ($world_y / sz_end);
}

proc emit_stacked_hlines t_start, t_end, row_start, row_count, grid_divisions {
    current_row = $row_start;
    repeat $row_count {
        _c "# Calculate the world Y based on your standard 240-height scale";
        world_y = 120 - (current_row * 240 / $grid_divisions);
        
        _c "# Let the partial h-line helper handle all the 3D math and clipping";
        emit_partial_hline $t_start, $t_end, world_y;
        
        current_row += 1;
    }
}

proc check_tile_visibility {
    _c "# Get 3D coords for Col 2";
    t_col2 = (current_tile * 9 + 1) / (edge_num_tiles * 9);
    tx2_3d = tx1 + t_col2 * (tx2 - tx1);
    tz2_3d = tz1 + t_col2 * (tz2 - tz1);
    
    _c "# Get 3D coords for Col 8";
    t_col8 = (current_tile * 9 + 8) / (edge_num_tiles * 9);
    tx8_3d = tx1 + t_col8 * (tx2 - tx1);
    tz8_3d = tz1 + t_col8 * (tz2 - tz1);

    _c "# If the entire tile is behind the camera, skip it entirely";
    if tz2_3d <= 0.1 and tz8_3d <= 0.1 {
        tile_vis = "blank_hidden";
        stop_this_script;
    }

    _c "# 3D Near-Plane Z-Clipping for straddling tiles";
    if tz2_3d < 0.1 {
        t_clip = (0.1 - tz2_3d) / (tz8_3d - tz2_3d);
        tx2_3d = tx2_3d + t_clip * (tx8_3d - tx2_3d);
        tz2_3d = 0.1;
    } elif tz8_3d < 0.1 {
        t_clip = (0.1 - tz8_3d) / (tz2_3d - tz8_3d);
        tx8_3d = tx8_3d + t_clip * (tx2_3d - tx8_3d);
        tz8_3d = 0.1;
    }

    _c "# Safe 2D Perspective Projection (Using focalLength)";
    sx2 = (tx2_3d / tz2_3d) * focalLength;
    sx8 = (tx8_3d / tz8_3d) * focalLength;

    _c "# Span Buffer 2D Visibility Flags (Using 0.5 buffer)";
    if sx2 > (wall_sx2 + 0.5) or sx8 < (wall_sx1 - 0.5) {
        tile_vis = "blank_hidden";
    } elif sx2 < (wall_sx1 - 0.5) and sx8 > (wall_sx2 + 0.5) {
        tile_vis = "blank_bothClipped";
    } elif sx2 < (wall_sx1 - 0.5) {
        tile_vis = "blank_leftClipped";
    } elif sx8 > (wall_sx2 + 0.5) {
        tile_vis = "blank_rightClipped";
    } else {
        tile_vis = "blank";
    }
}

proc emit_clipped_polygon {
    _c "# 1D Sutherland-Hodgman clip against wall_sx1 (Left) and wall_sx2 (Right)";
    
    _c "# Pass 1: Clip Left";
    delete next_poly_x; delete next_poly_y;
    len = length(poly_x);
    i = 1; 

    repeat length(poly_x) {
        prev_i = i - 1; if prev_i == 0 { prev_i = len; }
        cx = poly_x[i]; cy = poly_y[i];
        px = poly_x[prev_i]; py = poly_y[prev_i];
        
        c_inside = (cx >= wall_sx1);
        p_inside = (px >= wall_sx1);
        
        if c_inside != p_inside {
            t = (wall_sx1 - px) / (cx - px);
            add wall_sx1 to next_poly_x;
            add py + t * (cy - py) to next_poly_y;
        }
        if c_inside {
            add cx to next_poly_x;
            add cy to next_poly_y;
        }
        i += 1;
    }
    
    _c "# Copy Pass 1 to working lists";
    delete poly_x; delete poly_y;
    i = 1;
    repeat length(next_poly_x) {
        add next_poly_x[i] to poly_x;
        add next_poly_y[i] to poly_y;
        i += 1;
    }
    
    _c "# Pass 2: Clip Right";
    delete next_poly_x; delete next_poly_y;
    len = length(poly_x);
    i = 1;
    repeat len {
        prev_i = i - 1; if prev_i == 0 { prev_i = len; }
        cx = poly_x[i]; cy = poly_y[i];
        px = poly_x[prev_i]; py = poly_y[prev_i];
        
        c_inside = (cx <= wall_sx2);
        p_inside = (px <= wall_sx2);
        
        if c_inside != p_inside {
            t = (wall_sx2 - px) / (cx - px);
            add wall_sx2 to next_poly_x;
            add py + t * (cy - py) to next_poly_y;
        }
        if c_inside {
            add cx to next_poly_x;
            add cy to next_poly_y;
        }
        i += 1;
    }
    
    _c "# Phase 3 Append: Write perfectly bounded shape to drawCommands";
    len = length(next_poly_x);
    if len > 0 {
        add "gotoWalker" to drawCommands;
        i = 1;
        repeat len {
            add next_poly_x[i] to drawCommands;
            add next_poly_y[i] to drawCommands;
            i += 1;
        }
        add next_poly_x[1] to drawCommands; _c "# Close shape";
        add next_poly_y[1] to drawCommands;
        add "EoL" to drawCommands;
    }
}

proc  _c comment {}