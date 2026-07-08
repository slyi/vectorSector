hide;
set_x 0;
set_size 0;
costumes "assets/576aeb89.svg" as "blank", "assets/big.svg" as "big", "assets/eea92c50.svg" as "2dash", "assets/431b9a82.svg" as "3dash", "assets/1dash.svg" as "1dash", "assets/greekKeyA.svg" as "greekKeyA", "assets/greekKeyB.svg" as "greekKeyB", "assets/greekKeyC.svg" as "greekKeyC";
var renderTime=0;
var drawCount=0;

# Render Queue Variables
var rx1; var ry1; 
var rx2; var ry2;
var tile; var depth;
var q_len; var i;
var y1; var y2;
var face;

# Trapezoid Fill Variables
var base1; var base2; var base3; 
var xDir; var xDir2;
var abc; var dab; 
var oy1; var oy2; var oy3; var oy4;
var m1; var m2; 
var triX; var triY; 
var r; var radius; var ratio;
var ox; var oy; 
var a; var b; var c; var p;


list wallColors = ["#602700", "#80471C",  "#e8b7bd", "#B22222", "#C04657","#e8b7bd",]; # Base Brick Red, Default White

onflag {
    show drawCount;
}


on "renderWalls" {
    
   
    
    renderWalls;
    #renderTime = round(days_since_2000() * 86400000 - renderTime);
    #renderTime += "checkerboardFloor"."renderTime";
    #drawCount += "checkerboardFloor"."drawCount";
    #drawCountTotal= drawCount;
    
}

# =================================================================
# --- RENDERER (SHAPE GENERATION) ---------------------------------
# =================================================================

proc renderWalls {
    drawCount = 0;
    i = 1;
    renderTime = days_since_2000() * 86400000;   
    repeat  length(walls)/12 {
        _c "//1. EXTRACT 11-ELEMENT STRIDE";
        rx1   = walls[i];
        z1    = walls[i + 1];
        rx2   = walls[i + 2];
        z2    = walls[i + 3];
        face  = walls[i + 4];
        tile  = walls[i + 5]; 
        edge  = walls[i + 6];
        cmdIdx = walls[i + 7];
        wCeilY = walls[i + 8];
        wFlrY  = walls[i + 9];
        frameEdge_idx = walls[i + 10];
        
        _c "//Project true Y bounds";
        ceil_y1  = wCeilY / z1;
        floor_y1 = wFlrY / z1;
        ceil_y2  = wCeilY / z2;
        floor_y2 = wFlrY / z2;
        

        _c "//2. THE PALETTE LOOKUP";
        set_pen_color wallColors[tile-1];
        if tile==1 {set_pen_color wallColors[frameEdge[frameEdge_idx+3]+2]; }
        
        if face == 1 { change_pen_brightness -20; }
       
        if rx2-rx1 > 3 {
            _c "//3. DRAW SOLID WALL";
            if z1 < z2 {            
                trapezoid rx1, rx2, ceil_y1, floor_y1, floor_y2, ceil_y2, tile;
            } else {            
                trapezoid rx2, rx1, ceil_y2, floor_y2, floor_y1, ceil_y1, tile;
            }
        }
        else {
            _c "small Wall";
            
            set_pen_size abs(rx2-rx1)-0.5;
            goto (rx1+rx2)/2, (ceil_y1+ceil_y2)/2; 
            pen_down; 
            goto (rx1+rx2)/2, (ceil_y1+ceil_y2)/2;
            goto (rx1+rx2)/2, (floor_y1+floor_y2)/2;
            pen_up;
        }

        _c "//4. HAND OFF TO 2D DECORATION PARSER";
        if cmdIdx > 0 {
            drawWallShader cmdIdx, wCeilY, wFlrY;
        }
        

        _c "//Solid Structural Outline";
        set_pen_color "#000000";
        set_pen_size 1;
        goto rx1, ceil_y1; pen_down; goto rx1, floor_y1; 
        goto rx2, floor_y2; goto rx2, ceil_y2; goto rx1, ceil_y1; pen_up;
        drawCount += 5;


        i += 12;
    }
    renderTime = round(days_since_2000() * 86400000 - renderTime);
}

proc drawWallShader startIdx, worldCeilY, worldFloorY {
    vIdx = $startIdx;
    if (drawCommands[vIdx] == "EoW") {stop_this_script;}
    _c "//--- PHASE 1: STAMPS (Vertical Lines/Dashes) ---";
    point_in_direction  90 ;
    until drawCommands[vIdx] == "EoL" or vIdx > length(drawCommands) {
        sx = drawCommands[vIdx];
        sz = drawCommands[vIdx + 1];
        costume_id = drawCommands[vIdx + 2];
        if  "blank" not in costume_id { 
            alpha=(sz) * 10;
            if (abs(sx)<=240 and alpha<100){
                if 150<(66.66/sz) {switch_costume "blank";} else {switch_costume "big";}
                set_size (240 / 360 * 100) / sz;
                alpha = sz * 10;
                if abs(sx) <= 240 and alpha < 100 {
                    switch_costume costume_id;
                    
                    _c "//Find the true 2.5D vertical center of the wall at this depth";
                    y_center = (($worldCeilY / sz) + ($worldFloorY / sz)) / 2;
                                    
                    goto sx, y_center;
                    
                    set_ghost_effect alpha;
                    stamp;
                    drawCount += 1;
                }
            }
        }
        vIdx += 3;
    }
    
    _c "//Skip the \"EoL\" token";
    vIdx += 1;
    
    _c "//--- PHASE 2: PEN LINES  ---";
    _c "//Black 1 pixel lines";
    set_pen_size 1;
    set_pen_color "#000000";
    switch_costume "blank";
    set_size 1/0;
    set_pen_transparency 50;
    
    _c "# parse multiple gotoWalker commands if needed";
    until drawCommands[vIdx] != "gotoWalker" {
        vIdx += 1;
        _c "# 1. Setup Phase (Pen Up)";
        goto drawCommands[vIdx], drawCommands[vIdx + 1];
        pen_down;
        vIdx += 2;

        _c "# 2. Continuous Drawing Loop";
        until drawCommands[vIdx] == "EoL" {
            goto drawCommands[vIdx], drawCommands[vIdx + 1];
            drawCount += 1;
            vIdx += 2;
        }

        _c "# 3. Cleanup Phase";
        pen_up;
        vIdx += 1; 
        _c "# Step over the 'EoL' token to the next command";      
    }
    
        _c "# parse multiple dash_line commands if needed";
    until drawCommands[vIdx] != "dash_line" {
        goto drawCommands[vIdx+1], drawCommands[vIdx+2];
        point_in_direction drawCommands[vIdx+3];
        parity = drawCommands[vIdx+4];

        vIdx += 5;
        if parity == 1 { 
            until drawCommands[vIdx] == "EoL" {
                pen_down; 
                move drawCommands[vIdx]; 
                pen_up;
                move drawCommands[vIdx+1]; 
                drawCount += 1;
                vIdx += 2;
            } 
        } else { 
            until drawCommands[vIdx] == "EoL" {
                move drawCommands[vIdx]; 
                pen_down;
                move drawCommands[vIdx+1]; 
                pen_up;
                drawCount += 1;
                vIdx += 2;
            }
        }
        
        pen_up;
        vIdx += 1;
      
    }


    until drawCommands[vIdx] == "EoW" or vIdx > length(drawCommands) {

        _c "//Extract pre-calculated SCREEN coordinates and depth";
        px1 = drawCommands[vIdx];
        pz1 = drawCommands[vIdx + 1];
        py1 = drawCommands[vIdx + 2];
        
        px2 = drawCommands[vIdx + 3];
        pz2 = drawCommands[vIdx + 4];
        py2 = drawCommands[vIdx + 5];

        _c "//Calculate fog based purely on depth";
        alpha = ((pz1 + pz2) / 2) * 10;
        
        if (alpha < 100) {
            set_pen_transparency alpha;
            
            pen_up;
            goto px1, py1;
            pen_down;
            goto px2, py2;
            pen_up;
            
            drawCount += 1;
        }
        
        _c "//Advance by the 6-element line stride";
        vIdx += 6; 
    }
}

proc trapezoid x1, x2, y1, y2, y3, y4, accuracy {
    _c "//- vertical aligned trapezoid Filler ---------------------------";
    switch_costume "blank";
    set_size 1/0;
    base1 = $x1 - $x2;
    base2 = $y4 - $y3;
    xDir2 = base1 / abs(base1);
    xDir = -xDir2;
    abc = abs(atan(base1 * xDir / ($y2 - $y3)) + 180 * not ($y3 > $y2));
    dab = abs((180 - (atan(base1 * xDir / ($y1 - $y4)) + 180 * ($y4 > $y1))) % 180);
    oy1 = xDir * tan((180 - dab) / (2 * xDir2));
    oy2 = xDir * tan((180 - abc) / (2 * xDir));
    oy3 = xDir2 * tan(abc / (2 * xDir2));
    oy4 = xDir2 * tan(dab / (2 * xDir));
    
    if abs(base1) / 2 < base2 / 2 {
        radius = abs(base1) / 2;
    } else {
        radius = base2 / 2;
        if abc > 110 or dab > 110 {
            m1 = ($y4 - $y1) / ($x2 - $x1);
            m2 = ($y3 - $y2) / ($x2 - $x1);
            triX = (m1 * $x1 - m2 * $x1 + base2) / (m1 - m2);
            radius = abs(-base2 * (triX - $x1) / (2 * xDir) / ((-base2 + ((triX - $x1) * xDir / cos(atan(m1)) + (triX - $x1) * xDir / cos(atan(m2)))) / 2));
        }
        if ($y1 - $y2) / radius > 4 {
            rOffset = radius * 2;            
            fillTri $x1 + xDir * rOffset, $y1 + oy1 * rOffset, $y2 + oy2 * rOffset, ($y4 - $y1) / ($x2 - $x1), ($y3 - $y2) / ($x2 - $x1), xDir * oy1, xDir * oy2;
        }
    }
    if abc > dab {
        ratio = (1 - 1 / sqrt(1 + oy1 * oy1)) * 0.5;
    } else {
        ratio = (1 - 1 / sqrt(1 + oy2 * oy2)) * 0.5;
    }
    goto $x1 + xDir * radius, $y1 + oy1 * radius;
    set_pen_size 1;
    pen_down;
    
    repeat ceil(log(radius * $accuracy) / -log(ratio)) {
        set_pen_size 2 * radius;
        goto $x1 + xDir * radius, $y1 + oy1 * radius;
        goto $x1 + xDir * radius, $y2 + oy2 * radius;
        goto $x2 + xDir2 * radius, $y3 + oy3 * radius;
        goto $x2 + xDir2 * radius, $y4 + oy4 * radius;
        goto $x1 + xDir * radius, $y1 + oy1 * radius;
        radius *= ratio;
        drawCount += 5;
    }
    pen_up;
}

proc fillTri x1, y1, y2, m1, m2, mo1, mo2 {
    _c "//- MERGED fillTri ----------------------------------------------";
    base3 = $y1 - $y2;
    triX = round(($m1 * $x1 - $m2 * $x1 - base3) / ($m1 - $m2));
    inradius = 2 * (base3 * (triX - $x1) / (2 * xDir) / ((base3 + ((triX - $x1) * xDir / cos(atan($m1)) + (triX - $x1) * xDir / cos(atan($m2)))) / 2));

    if inradius > 0 {
        triY = $m1 * (triX - $x1) + $y1;

        _c "//Calculate the incenter ONCE to avoid x_position() shifting during the loop";
        inX = ($y2 - $y1 + ($mo1 * $x1 - $mo2 * $x1)) / ($mo1 - $mo2);
        inY = ($mo1 * $y2 - $mo2 * $y1) / ($mo1 - $mo2);
        
        _c "//Calculate squared distances from incenter to each vertex (Fixes undefined a, b, c)";
        distA = (inX - $x1) * (inX - $x1) + (inY - $y1) * (inY - $y1);
        distB = (inX - $x1) * (inX - $x1) + (inY - $y2) * (inY - $y2);
        distC = (inX - triX) * (inX - triX) + (inY - triY) * (inY - triY);
        
        _c "//Determine the shortest distance (replaces the original a, b, c logic)";
        if distA < distB and distA < distC {
            p = 1 - inradius / (4 * sqrt(distA));
        } elif distB < distC {
            p = 1 - inradius / (4 * sqrt(distB));
        } else {
            p = 1 - inradius / (4 * sqrt(distC));
        }

        set_pen_size inradius;
        goto inX, inY;
        pen_down;
        triLoopSize = ceil(ln(2.5 / inradius) / ln(p)) + 1;
        b = p;
       
        _c "//Drawing loop with compounded inline vector math";
        repeat triLoopSize {
            set_pen_size p * inradius;
            
            _c "//Replaced x2 with $x1, and inlined the vector offsets";
            goto $x1 + p * (inX - $x1), $y1 + p * (inY - $y1);
            goto $x1 + p * (inX - $x1), $y2 + p * (inY - $y2);
            goto triX + p * (inX - triX), triY + p * (inY - triY);
            goto $x1 + p * (inX - $x1), $y1 + p * (inY - $y1);
            
            p *= b;            
        }
        drawCount += triLoopSize * 4;
        set_pen_size inradius/5;
        goto $x1, $y1;
        goto $x1, $y2;  
        goto triX, triY;
        goto $x1, $y1;
        pen_up;
        drawCount += 4;
    }
}
proc  _c comment {}
