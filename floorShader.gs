costumes "assets/91223aa3.svg" as "blank";

# =================================================================
# --- SPRITE VARIABLES (floorShader.gs) ---------------------------
# =================================================================

# Global Engine & Camera State
var playerX = 0; 
var playerY = 0; 
var playerDir = 0;
var cam_sin = 0; 
var cam_cos = 0;
var focalLength = 240;
var floorYOffset = -120;
var floorTextureId = 1; 

# Shared Clipping & Line Projection Variables
var dX1=0; var dY1=0; var depth1=0; var viewX1=0;
var dX2=0; var dY2=0; var depth2=0; var viewX2=0;
var screenX1=0; var screenY1=0; var screenX2=0; var screenY2=0;
var clip_t=0;

# Grid & Plank Specific Variables
var startX=0; var startY=0; var endX=0; var endY=0;
var currentX=0; var currentY=0; var radius = 16;
var plankWidth = 0.5; var plankLength = 1;
var max_corridor_depth = 16;
var col_idx=0; var board_offset=0; var skip_dash=0;
var dash_delta_rX=0; var dash_delta_rZ=0;
var dash_rX=0; var dash_rZ=0; var dash_sX=0; var dash_sY=0;

# Checkerboard Specific Variables
var currentTile=0; var tileX=0; var tileY=0; var t_idx=0;
var dxA=0; var dyA=0; var rxA=0; var rzA=0;
var xA=0; var zA=0; var xB=0; var zB=0; var xC=0; var zC=0; var xD=0; var zD=0;
var a=0; var b=0; var c=0; var p=0; var r=0; var loopSize=0;

# Diagnostics
var drawCount = 0;
var renderTimeFloor = 0;


# =================================================================
# --- INITIALIZATION & MAIN HOOK ----------------------------------
# =================================================================

onflag {
    set_size 1/0; # Max size bypass for off-screen rendering
    switch_costume "blank";
    hide;
}

on "renderFloor" {
    renderTimeFloor = days_since_2000() * 86400000;
    drawCount = 0;
    
    # 1. Pull Ground Truth Camera States
    playerX = "vectorRooms"."playerX";
    playerY = "vectorRooms"."playerY";
    playerDir = "vectorRooms"."playerDir";
    floorTextureId = "vectorRooms"."roomTextureId"; 
    
    # 2. Pre-calculate Trigonometry ONCE per frame
    cam_sin = sin(playerDir);
    cam_cos = cos(playerDir);
    
    # 3. Route to Pattern
    pen_up;
    if floorTextureId == 2 {
        draw_plank_grid;
    } elif floorTextureId == 3 {
        draw_basic_grid;
    }
    else   {
        draw_checkerboard;
    } 
    pen_up;
    
    renderTimeFloor = round(days_since_2000() * 86400000 - renderTimeFloor);
}


# =================================================================
# --- PATTERN 1: CHECKERBOARD FLOOR (Filled Triangles) ------------
# =================================================================

proc draw_checkerboard {
    set_pen_color "#222222";
    t_idx = 1;
    
    repeat length(frustrumFloorTiles) {
        currentTile = frustrumFloorTiles[t_idx];
        tileX = (currentTile - 1) % 64; 
        tileY = floor((currentTile - 1) / 64);

        dxA = tileX - playerX;
        dyA = tileY - playerY;
        
        rxA = dxA * cam_cos - dyA * cam_sin;
        rzA = dxA * cam_sin + dyA * cam_cos;

        xA = rxA; zA = rzA;
        xB = rxA + cam_cos; zB = rzA + cam_sin;
        xC = rxA + cam_cos - cam_sin; zC = rzA + cam_sin + cam_cos;
        xD = rxA - cam_sin; zD = rzA + cam_cos;

        if zA > 0.1 or zB > 0.1 or zC > 0.1 or zD > 0.1 {
            if zA < 0.1 { zA = 0.1; }
            if zB < 0.1 { zB = 0.1; }
            if zC < 0.1 { zC = 0.1; }
            if zD < 0.1 { zD = 0.1; }
        }
        
        set_pen_transparency -50 + zA * 10;

        fillFloorQuad (xA * focalLength) / zA, floorYOffset / zA, 
                      (xB * focalLength) / zB, floorYOffset / zB, 
                      (xC * focalLength) / zC, floorYOffset / zC, 
                      (xD * focalLength) / zD, floorYOffset / zD;
        t_idx += 1;
    }
}

proc fillFloorQuad x1, y1, x2, y2, x3, y3, x4, y4 {
    azexTriFiller $x1, $y1, $x2, $y2, $x3, $y3;
    azexTriFiller $x1, $y1, $x3, $y3, $x4, $y4;
}

proc azexTriFiller x1, y1, x2, y2, x3, y3 {
    a = sqrt(($x2 - $x3) * ($x2 - $x3) + ($y2 - $y3) * ($y2 - $y3));
    b = sqrt(($x3 - $x1) * ($x3 - $x1) + ($y3 - $y1) * ($y3 - $y1));
    c = sqrt(($x2 - $x1) * ($x2 - $x1) + ($y2 - $y1) * ($y2 - $y1));
    p = a + (b + c);
    r = sqrt((c + b - a) * (a + c - b) * (p - c * 2) / p);
    goto (a * $x1 + b * $x2 + c * $x3) / p, (a * $y1 + b * $y2 + c * $y3) / p;
    azexTriangleHelper x_position() - $x1, y_position() - $y1, x_position() - $x2, y_position() - $y2, x_position() - $x3, y_position() - $y3, r, $x1, $y1, $x2, $y2, $x3, $y3;
}

proc azexTriangleHelper inx1, iny1, inx2, iny2, in3x, in3y, inr, x1, y1, x2, y2, x3, y3 {
    if a < b and a < c { a = 0.5 - $inr / (4 * sqrt($inx1 * $inx1 + $iny1 * $iny1)); }
    elif b < c { a = 0.5 - $inr / (4 * sqrt($inx2 * $inx2 + $iny2 * $iny2)); }
    else { a = 0.5 - $inr / (4 * sqrt($in3x * $in3x + $in3y * $in3y)); }
    
    set_pen_size $inr;
    pen_down;
    set_pen_size a * $inr + 2;
    goto $x3 + a * $in3x, $y3 + a * $in3y;
    
    b = a;
    loopSize = ceil(ln(2.5/$inr) / ln(a))+1;
    repeat loopSize {
        set_pen_size a * $inr + 2;
        goto $x1 + a * $inx1, $y1 + a * $iny1;
        goto $x2 + a * $inx2, $y2 + a * $iny2;
        goto $x3 + a * $in3x, $y3 + a * $in3y;
        a *= b;
    }
    drawCount += (loopSize * 3) + 1;
    pen_up;
}


# =================================================================
# --- PATTERN 2: OFFSET PLANK GRID (Wireframe / Lines) ------------
# =================================================================

proc draw_plank_grid {
    set_pen_color "#000000";
    set_pen_size 1;
    set_pen_transparency 66;

    startX = floor(roomBB[1] / plankWidth) * plankWidth;
    startY = floor(roomBB[2] / plankLength) * plankLength;
    endX = ceil(roomBB[3] / plankWidth) * plankWidth;
    endY = ceil(roomBB[4] / plankLength) * plankLength;

    dash_delta_rX = plankWidth * cam_cos;
    dash_delta_rZ = plankWidth * cam_sin;

    # Pass 1: Vertical Planks (Uses Inline Clipping for VM Speed)
    currentX = startX;
    until currentX > endX {
        depth1 = (currentX - playerX) * cam_sin + (startY - playerY) * cam_cos;
        depth2 = (currentX - playerX) * cam_sin + (endY - playerY) * cam_cos;
        
        if depth1 > 0.1 or depth2 > 0.1 {
            viewX1 = (currentX - playerX) * cam_cos - (startY - playerY) * cam_sin;
            viewX2 = (currentX - playerX) * cam_cos - (endY - playerY) * cam_sin;
            
            skip_dash = 0;
            if depth1 < 0.1 and depth2 < 0.1 { skip_dash = 1; } 
            else {
                if depth1 < 0.1 {
                    clip_t = (0.1 - depth1) / (depth2 - depth1);
                    viewX1 += clip_t * (viewX2 - viewX1);
                    depth1 = 0.1;
                }
                if depth2 < 0.1 {
                    clip_t = (0.1 - depth2) / (depth1 - depth2);
                    viewX2 += clip_t * (viewX1 - viewX2);
                    depth2 = 0.1;
                }
            }

            if skip_dash == 0 {
                pen_up;
                goto (viewX1 * focalLength) / depth1, floorYOffset / depth1;
                pen_down;
                goto (viewX2 * focalLength) / depth2, floorYOffset / depth2;
                drawCount+=1;
            }
        }
        currentX += plankWidth;
    }

    _c "# Pass 2: Horizontal Dashes (Frustum Culled)";
    currentX = startX;
    until currentX > endX - 0.1 {
        col_idx = round(currentX / plankWidth);
        board_offset = (abs(col_idx) % 2) * (plankLength / 2);
        currentY = startY - plankLength + board_offset;

        until currentY > endY {
            skip_dash = 0;
            viewX1 = (currentX - playerX) * cam_cos - (currentY - playerY) * cam_sin;
            depth1 = (currentX - playerX) * cam_sin + (currentY - playerY) * cam_cos;

            if depth1 > max_corridor_depth or depth1 < 0.1 { skip_dash = 1; }
            if skip_dash == 0 and abs(viewX1) > (depth1 + plankWidth) { skip_dash = 1; }

            if skip_dash == 0 {
                dash_rZ = depth1 + dash_delta_rZ;
                if dash_rZ > 0.1 {
                    pen_up;
                    goto (viewX1 * focalLength) / depth1, floorYOffset / depth1;
                    pen_down;
                    dash_rX = viewX1 + dash_delta_rX;
                    goto (dash_rX * focalLength) / dash_rZ, floorYOffset / dash_rZ;
                    drawCount+=1;
                }
            }
            currentY += plankLength;
        }
        currentX += plankWidth;
    }
}


# =================================================================
# --- PATTERN 3: INFINITE GRID (Wireframe / Lines) ----------------
# =================================================================

proc draw_basic_grid {
    set_pen_color "#000000";
    set_pen_size 1;
    set_pen_transparency 66;

    _c "# Use roomBB for tight bounding: [1]=minX, [2]=minY, [3]=maxX, [4]=maxY";
    startX = floor(roomBB[1]);
    startY = floor(roomBB[2]);
    endX = ceil(roomBB[3]);
    endY = ceil(roomBB[4]);

    _c "# Vertical grid lines (X constant, Y varies)";
    currentX = startX;
    repeat (endX - startX + 1) {
        emit_clipped_floor_line currentX, startY, currentX, endY;
        currentX += 1;
    }

    _c "# Horizontal grid lines (Y constant, X varies)";
    currentY = startY;
    repeat (endY - startY + 1) {
        emit_clipped_floor_line startX, currentY, endX, currentY;
        currentY += 1;
    }
}

proc emit_clipped_floor_line mapX1, mapY1, mapX2, mapY2 {
    dX1 = $mapX1 - playerX; dY1 = $mapY1 - playerY;
    depth1 = dX1 * cam_sin + dY1 * cam_cos;
    viewX1 = dX1 * cam_cos - dY1 * cam_sin;
    
    dX2 = $mapX2 - playerX; dY2 = $mapY2 - playerY;
    depth2 = dX2 * cam_sin + dY2 * cam_cos;
    viewX2 = dX2 * cam_cos - dY2 * cam_sin;

    if not (depth1 < 0.1) or not (depth2 < 0.1) {
        if depth1 < 0.1 {
            clip_t = (0.1 - depth1) / (depth2 - depth1);
            viewX1 += clip_t * (viewX2 - viewX1);
            depth1 = 0.1;
        }
        if depth2 < 0.1 {
            clip_t = (0.1 - depth2) / (depth1 - depth2);
            viewX2 += clip_t * (viewX1 - viewX2);
            depth2 = 0.1;
        }

        pen_up;
        goto viewX1 * (focalLength / depth1), floorYOffset / depth1;
        pen_down;
        goto viewX2 * (focalLength / depth2), floorYOffset / depth2;
        drawCount += 1;
    }
}

proc _c comment {} 