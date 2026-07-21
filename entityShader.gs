hide;
costumes "assets/91223aa3.svg" as "blank";

# =================================================================
# --- SPRITE VARIABLES (entityShader.gs) ------------------------
# =================================================================
var focalLength;
var i; var j; var temp;
var q_len;

# Entity 6-Stride Extraction
var e_type; var e_zAvg;
var e_x1; var e_z1;
var e_x2; var e_z2;
var playerDir;

# Screen Projection
var sx1; var sx2; var sy; var radius;

# Barrel (type 1) tunables — calibrated to the 240x360 native barrelBody costume
var SQUASH_REF = 0.25;  # rim squash at REF_DEPTH (kept < ~0.33 so w > h, never a degenerate circle)
var REF_DEPTH = 6;      # reference camera depth (world units)
var BODY_SIZE_NUM = 1.25; # set_size numerator; native barrelBody is 480x720, fills 1/3 tile width & half wall height at REF_DEPTH
var BRIGHTNESS_DELTA = -15; # lid darkness relative to body
var BUNG_BRIGHTNESS_DELTA = -80; # bung hole is much darker (reads as a hole)
var ORBIT_FRAC = 0.6;   # how far toward the lid rim the bung orbits
var BUNG_SIZE_FRAC = 0.2;   # bung ellipse radius as fraction of lid half-width/height
var MIN_ENTITY_Z = 0.7;     # near-plane clamp so a barrel walked-right-up-to fills only a bounded screen fraction (prevents 1/z projection blow-up)

# Plant pot (type 1) tunables — calibrated to the 240x360 native plantPot costume
var POT_SQUASH_REF = 0.25;
var POT_REF_DEPTH = 6;
var POT_BODY_SIZE_NUM = 1.9;
var POT_LEAF_BRIGHTNESS_DELTA = -25;
var POT_MIN_ENTITY_Z = 0.7;

# Barrel working vars
var ent_sx; var floor_y; var top_y; var tile_w; var penSize;
var ratio; var w; var h; var bx; var by;

# Plant pot working vars
var pot_sx; var pot_floor_y; var pot_top_y; var pot_tile_w; var pot_penSize;
var pot_ratio; var pot_w; var pot_h; var stem_top_y;
var leaf_x; var leaf_y; var leaf_angle; var leaf_len; var leaf_w;

# Entity facing direction (world azimuth of the barrel's bunghole feature)
var e_dir;

# Entity view direction (world azimuth from entity to player)
var e_viewDir;

list entityDebug = [];

on "entityShader" {
    process_entities;
}


proc process_entities {
    _c "#Process entities and append to drawCommands";    
    delete entityDebug;
    focalLength = "vectorRooms"."focalLength";

    playerX = "vectorRooms"."playerX";
    playerY = "vectorRooms"."playerY";
    playerDir = "vectorRooms"."playerDir";
    camSin = sin(playerDir);
    camCos = cos(playerDir);    
    i = 1;
    ent_count=length(frameEntity)/11 ;
    repeat ent_count {
        frameEntity[i + 7]=length(drawCommands) + 1;
        e_type = frameEntity[i];
        e_zAvg = frameEntity[i + 1];
        e_x1   = frameEntity[i + 2];
        e_z1   = frameEntity[i + 3];
        e_x2   = frameEntity[i + 4];
        e_z2   = frameEntity[i + 5];

        _c "# Near-plane clamp: entity billboards scale as 1/z, so a barrel";
        _c "# walked right up to the camera (z->0.1) would explode to fill the";
        _c "# screen. Clamp the projection depth to a sane minimum.";
        if e_zAvg < MIN_ENTITY_Z { e_zAvg = MIN_ENTITY_Z; }
        if e_z1   < MIN_ENTITY_Z { e_z1   = MIN_ENTITY_Z; }
        if e_z2   < MIN_ENTITY_Z { e_z2   = MIN_ENTITY_Z; }
        e_roomId   = frameEntity[i + 6];
        e_drawIdx   = frameEntity[i + 7];
        e_dir   = frameEntity[i + 8];
        e_viewDir = frameEntity[i + 9];
        e_tileIdx = frameEntity[i + 10];

        _c "# Project 3D bounds to Screen X";
        sx1 = (e_x1 / e_z1) * focalLength;
        sx2 = (e_x2 / e_z2) * focalLength;
        
        _c "# Project World Y to Screen Y (Assuming entities sit on the floor)";
        _c "# Using a standard 120 offset for the floor";
        sy = 120 / e_zAvg;
        
        _c "create entity drawCommands for each entity type found";            
        if e_type == 1 { 
            drawChair;
        }
        elif e_type == 2 {
            drawPlantPot;
        }
        elif e_type == 3 {
            drawBarrel;
        }

        add "EoEnt" to drawCommands;
        i += 11;
    }
}


proc drawBarrel {
    ent_sx = round((sx1 + sx2) / 2);
    floor_y = -120 / e_zAvg;
    top_y = 0;
    tile_w = abs(sx2 - sx1);
    penSize = tile_w / 3;

    ratio = SQUASH_REF * REF_DEPTH / e_zAvg;
    if ratio > 0.25 { ratio = 0.25; }
    if ratio < 0.05 { ratio = 0.05; }
    w = penSize / 2;
    h = w * ratio;

    # Body stamp
    add "stamp" to drawCommands;
    add ent_sx to drawCommands;
    add floor_y + (top_y - floor_y) / 2 to drawCommands;      # body center Y
    add penSize * BODY_SIZE_NUM / REF_DEPTH to drawCommands;   # set_size (tunable)
    add 90 to drawCommands;                                   # direction
    add "barrelBody" to drawCommands;

    # Lid ellipse
    add "ellipse" to drawCommands;
    add ent_sx to drawCommands;
    add top_y to drawCommands;
    add w to drawCommands;
    add h to drawCommands;
    add 90 to drawCommands;
    add BRIGHTNESS_DELTA to drawCommands;
    add "#366A9E" to drawCommands;

    # Bung ellipse (orbiting) — e_dir is the resolved bung bearing (rel) carried in
    # frameEntity by process_room: entityDir - viewDir, where viewDir is the world
    # azimuth from the barrel to the player. rel=0 -> near rim (bottom); rel=180 -> far rim.
    bx = ent_sx + ORBIT_FRAC * w * sin(e_dir);
    by = top_y  + ORBIT_FRAC * h * cos(e_dir);
    add "ellipse" to drawCommands;
    add bx to drawCommands;
    add by to drawCommands;
    add w * BUNG_SIZE_FRAC to drawCommands;
    add h * BUNG_SIZE_FRAC to drawCommands;
    add 90 to drawCommands;
    add BUNG_BRIGHTNESS_DELTA to drawCommands;
    add "#366A9E" to drawCommands;
}

proc drawPlantPot {
    pot_sx = round((sx1 + sx2) / 2);
    pot_floor_y = -120 / e_zAvg;
    pot_top_y = 0;
    pot_tile_w = abs(sx2 - sx1);
    pot_penSize = pot_tile_w / 3;

    pot_ratio = POT_SQUASH_REF * POT_REF_DEPTH / e_zAvg;
    if pot_ratio > 0.25 { pot_ratio = 0.25; }
    if pot_ratio < 0.05 { pot_ratio = 0.05; }
    
    pot_w = pot_penSize / 2;
    pot_h = pot_w * pot_ratio;

    leaf_scale = pot_penSize * POT_BODY_SIZE_NUM / POT_REF_DEPTH;
    
    # Base pot screen anchor
    pot_center_y = pot_floor_y + (pot_top_y - pot_floor_y) / 2;
    
    # Stem height scaled relative to depth/leaf_scale
    stem_height = leaf_scale * 1.8;
    top_of_stem_y = pot_center_y + stem_height;

    # Pot stamp
    add "stamp" to drawCommands;
    add pot_sx to drawCommands;
    add pot_center_y to drawCommands;
    add leaf_scale to drawCommands;
    add 90 to drawCommands;
    add "plantPot" to drawCommands;

    # Calculate absolute view angle
    view_angle = e_dir;

    # Draw 3 leaves: drawLeaf world_angle, offset_mult, len_mult, w_mult, color
    drawLeaf 25,    0.5,      1.2, 0.40, "#54c057"; # Leaf 1 (Brown - Top of stem)
    drawLeaf 145, -0.2, 1.0, 0.33, "#4aa34d"; # Leaf 2 (Green - 1/3 down)
    drawLeaf 265, -0.6, 0.8, 0.26, "#367a38"; # Leaf 3 (Red   - 2/3 down)
}

proc drawLeaf world_angle, offset_mult, len_mult, w_mult, color {
    leaf_angle = $world_angle - view_angle;
    leaf_len_base = leaf_scale * $len_mult; 
    leaf_w_base = leaf_scale * $w_mult;
    leaf_y = top_of_stem_y + (stem_height * $offset_mult);
    
    leaf_dx = sin(leaf_angle);
    leaf_dy = cos(leaf_angle) * pot_ratio;
    leaf_screen_len = leaf_len_base * sqrt(leaf_dx * leaf_dx + leaf_dy * leaf_dy);
    
    if leaf_dy == 0 {
        if leaf_dx > 0 { leaf_screen_angle = 90; } else { leaf_screen_angle = -90; }
    } else {
        leaf_screen_angle = atan(leaf_dx / leaf_dy);
        if leaf_dy < 0 { leaf_screen_angle = leaf_screen_angle + 180; }
    }
    
    leaf_w_dx = cos(leaf_angle);
    leaf_w_dy = sin(leaf_angle) * pot_ratio;
    leaf_screen_w = leaf_w_base * sqrt(leaf_w_dx * leaf_w_dx + leaf_w_dy * leaf_w_dy);
    
    # Clamp to prevent ellipse from turning into a circle
    if leaf_screen_w > leaf_screen_len * 0.4 { 
        leaf_screen_w = leaf_screen_len * 0.4; 
    }

    add "ellipse" to drawCommands;
    add pot_sx + leaf_len_base * leaf_dx to drawCommands;
    add leaf_y + leaf_len_base * leaf_dy to drawCommands;
    add leaf_screen_len to drawCommands;
    add leaf_screen_w to drawCommands;
    add leaf_screen_angle to drawCommands;
    add POT_LEAF_BRIGHTNESS_DELTA to drawCommands;
    add $color to drawCommands;
    add "penline" to drawCommands;
    add pot_sx to drawCommands;
    add leaf_y to drawCommands;
    add pot_sx + (leaf_len_base * 2) * leaf_dx to drawCommands;
    add leaf_y + (leaf_len_base * 2) * leaf_dy to drawCommands;
    add 1 to drawCommands;
}

proc transformVertex lx, ly, lz {
    _c "# 1. Local entity rotation (Yaw)";
    rotX = $lx * ent_cos - $ly * ent_sin;
    rotY = $lx * ent_sin + $ly * ent_cos;

    _c "# 2. World translation (relative to player)";
    worldX = rotX + ent_cx;
    worldY = rotY + ent_cy;

    _c "# 3. Camera rotation (Yaw)";
    camX = worldX * camCos - worldY * camSin;
    camZ = worldX * camSin + worldY * camCos;

    _c "# 4. Screen Projection";
    _c "# Z is assumed > 0 due to grid collision culling";
    out_x = (camX * focalLength) / camZ;
    
    _c "# Add height (lz) to floor offset. Adding pushes it UP.";
    out_y = (floorYOffset + $lz) / camZ;
}

proc drawChair {

    tileX = (e_tileIdx - 1) % 64;
    tileY = floor((e_tileIdx - 1) / 64);
    
    _c "# 1. Calculate center of the tile relative to the player";
    ent_cx = (tileX + 0.5) - playerX;
    ent_cy = (tileY + 0.5) - playerY;
    
    _c "# 2. Precompute trig for the entity's FIXED world rotation";
    e_entityDir = 90;
    ent_cos = cos(e_entityDir);
    ent_sin = sin(e_entityDir);
    
    floorYOffset = -120;

    _c "# --- CHAIR DIMENSIONS ---";
    hw = 0.15;  
    hd = 0.15;  
    seatZ = 60;  
    backZ = 130; 
    
    _c "# --- 3. CALCULATE ALL VERTICES FIRST ---";
    _c "# Seat Corners";
    transformVertex 0 - hw, 0 - hd, seatZ; sAx = out_x; sAy = out_y;
    transformVertex hw, 0 - hd, seatZ;     sBx = out_x; sBy = out_y;
    transformVertex hw, hd, seatZ;         sCx = out_x; sCy = out_y;
    transformVertex 0 - hw, hd, seatZ;     sDx = out_x; sDy = out_y;

    _c "# Backrest Top Corners";
    transformVertex hw, hd, backZ;         bCy = out_y;
    transformVertex 0 - hw, hd, backZ;     bDy = out_y;
    
    _c "# Leg Floor Contacts";
    transformVertex 0 - hw, 0 - hd, 0; fAy = out_y;
    transformVertex hw, 0 - hd, 0;     fBy = out_y;
    transformVertex hw, hd, 0;         fCy = out_y;
    transformVertex 0 - hw, hd, 0;     fDy = out_y;
    
    leg_thick = 3;
    leg_col = "#654321";

    _c "# --- 4. DEPTH SORTING (Painter's Algorithm) ---";
    _c "# Dot product to find which side of the chair's dividing plane the player is on";
    isBehind = ((ent_cx * ent_sin) - (ent_cy * ent_cos)) > 0;

    if isBehind {
        _c "# --- PLAYER IS BEHIND THE CHAIR ---";
                
         _c "# 1. Front Legs ";
        add "penline" to drawCommands; add sAx to drawCommands; add sAy to drawCommands; add sAx to drawCommands; add fAy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;
        add "penline" to drawCommands; add sBx to drawCommands; add sBy to drawCommands; add sBx to drawCommands; add fBy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;

        _c "# 2. Back Legs";
        add "penline" to drawCommands; add sCx to drawCommands; add sCy to drawCommands; add sCx to drawCommands; add fCy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;
        add "penline" to drawCommands; add sDx to drawCommands; add sDy to drawCommands; add sDx to drawCommands; add fDy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;

        _c "# 3. Seat";
        add "quad" to drawCommands; add sAx to drawCommands; add sAy to drawCommands; add sBx to drawCommands; add sBy to drawCommands; add sCx to drawCommands; add sCy to drawCommands; add sDx to drawCommands; add sDy to drawCommands; add "#8B4513" to drawCommands; add 1 to drawCommands;

        _c "# 4. Backrest (Closest)";
        add "trapezoid" to drawCommands; add sDx to drawCommands; add sCx to drawCommands; add bDy to drawCommands; add sDy to drawCommands; add bCy to drawCommands; add sCy to drawCommands; add "#A0522D" to drawCommands; add 1 to drawCommands;

    } else {
        _c "# --- PLAYER IS IN FRONT OF THE CHAIR ---";
        
        _c "# 1. Backrest (Furthest)";
        add "trapezoid" to drawCommands; add sDx to drawCommands; add sCx to drawCommands; add bDy to drawCommands; add sDy to drawCommands; add bCy to drawCommands; add sCy to drawCommands; add "#A0522D" to drawCommands; add 1 to drawCommands;

       
        _c "# 2. Back Legs";
        add "penline" to drawCommands; add sCx to drawCommands; add sCy to drawCommands; add sCx to drawCommands; add fCy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;
        add "penline" to drawCommands; add sDx to drawCommands; add sDy to drawCommands; add sDx to drawCommands; add fDy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;

        _c "# 3. Front Legs (Closest)";
        add "penline" to drawCommands; add sAx to drawCommands; add sAy to drawCommands; add sAx to drawCommands; add fAy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;
        add "penline" to drawCommands; add sBx to drawCommands; add sBy to drawCommands; add sBx to drawCommands; add fBy to drawCommands; add leg_thick to drawCommands; add leg_col to drawCommands;

         _c "# 4. Seat";
        add "quad" to drawCommands; add sAx to drawCommands; add sAy to drawCommands; add sBx to drawCommands; add sBy to drawCommands; add sCx to drawCommands; add sCy to drawCommands; add sDx to drawCommands; add sDy to drawCommands; add "#8B4513" to drawCommands; add 1 to drawCommands;

    }
}


proc _c comment {}