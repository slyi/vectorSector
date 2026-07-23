hide;
set_x 0;
set_size 0;
costumes "assets/576aeb89.svg" as "blank", "assets/big.svg" as "big", "assets/eea92c50.svg" as "2dash", "assets/431b9a82.svg" as "3dash", "assets/1dash.svg" as "1dash", "assets/greekKeyA.svg" as "greekKeyA", "assets/greekKeyB.svg" as "greekKeyB", "assets/greekKeyC.svg" as "greekKeyC", "assets/barrelBody.svg" as "barrelBody", "assets/plantPot.svg" as "plantPot";
var renderTime=0;
var drawCount=0;
var lines_drawn;

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
    renderAll;
}

proc renderAll {
    
    drawCount = 0;
    connectedRoom = "vectorRooms"."connectedRoom";
    currentRoom = "vectorRooms"."currentRoom";
    
    renderTime = days_since_2000() * 86400000;
    _c "draw connected room first";
    if connectedRoom > -1{ 
        drawRoom connectedRoom;        
    }
    _c "draw current room last";
    drawRoom currentRoom;
    
    renderTime = round(days_since_2000() * 86400000 - renderTime);
    
}

# =================================================================
# --- RENDERER (SHAPE GENERATION) ---------------------------------
# =================================================================

proc drawRoom roomId{
    _c "draw walls first then entities for each room";
    drawWalls $roomId;
    drawEntities $roomId;
}


proc drawWalls roomId {
    
    wallIdx = 1;
    
    repeat length(walls)/13 {
        if walls[wallIdx + 5] != 1 or walls[wallIdx + 12] == $roomId {
            
            _c "//1. EXTRACT 13-ELEMENT STRIDE";
            rx1   = walls[wallIdx];
            z1    = walls[wallIdx + 1];
            rx2   = walls[wallIdx + 2];
            z2    = walls[wallIdx + 3];
            face  = walls[wallIdx + 4];
            tile  = walls[wallIdx + 5]; 
            edge  = walls[wallIdx + 6];
            cmdIdx = walls[wallIdx + 7];
            wCeilY = walls[wallIdx + 8];
            wFlrY  = walls[wallIdx + 9];
            frameEdge_idx = walls[wallIdx + 10];
            textureId= walls[wallIdx + 11];
            roomId= walls[wallIdx + 12];
            
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

           
        }
        wallIdx += 13;
    }    
}

proc drawEntities roomId {
    
    ent_idx = 1;
    
    repeat length(frameEntity) / 11 { 
        if frameEntity[ent_idx + 6] == $roomId {
            ent_type = frameEntity[ent_idx];
            roomId = frameEntity[ent_idx + 6];
            vIdx = frameEntity[ent_idx + 7];
            
            if (drawCommands[vIdx] != "EoEnt") {
                drawEntityShader;
            }
        }
        ent_idx += 11;
    }
}

proc drawEntityShader{
        
    until drawCommands[vIdx] == "EoEnt" or vIdx > length(drawCommands) {
        cmd = drawCommands[vIdx];
        if cmd == "stamp" {
            _c "# token + (x, y, size, dir, costume_name) = 6 elements";

            set_ghost_effect 0;
            switch_costume drawCommands[vIdx + 5];
            point_in_direction drawCommands[vIdx + 4];
            set_size 1/0;
            goto drawCommands[vIdx + 1], drawCommands[vIdx + 2];
            set_size drawCommands[vIdx + 3];
            stamp;
            drawCount += 1;
            vIdx += 6;
        } elif cmd == "ellipse" {
            _c "# token + (x, y, w, h, dir, brightnessDelta, color) = 8 elements";
            ex = vIdx + 1; ey = vIdx + 2;
            ew = vIdx + 3; eh = vIdx + 4; edir = vIdx + 5;
            ebr = vIdx + 6; ecol = vIdx + 7;
            set_pen_transparency 0;
            set_pen_color drawCommands[ecol];
            set_size 1/0;
            goto drawCommands[ex], drawCommands[ey];
            change_pen_brightness drawCommands[ebr];
            draw_ellipse drawCommands[ex], drawCommands[ey], drawCommands[ew], drawCommands[eh], drawCommands[edir];
            change_pen_brightness -drawCommands[ebr];
            drawCount += 1;
            vIdx += 8;
        } elif cmd == "penline" {
            _c "# token + (x1, y1, x2, y2, pen_size) = 6 elements";

            set_pen_transparency 0;
            set_pen_size drawCommands[vIdx + 5];
            set_size 1/0;
            pen_up; goto drawCommands[vIdx + 1], drawCommands[vIdx + 2];
            pen_down; goto drawCommands[vIdx + 3], drawCommands[vIdx + 4]; pen_up;
            drawCount += 1;
            vIdx += 6;
        } elif cmd == "trapezoid" {
            _c "# Trapezoid token + (x1, x2, y1, y2, y3, y4, color, border) = 9 elements";
            # Extract the projected coordinates and color
            rx1 = drawCommands[vIdx+1];
            rx2 = drawCommands[vIdx+2];
            ceil_y1 = drawCommands[vIdx+3];
            floor_y1 = drawCommands[vIdx+4];
            ceil_y2 = drawCommands[vIdx+5];
            floor_y2 = drawCommands[vIdx+6];
            t_color = drawCommands[vIdx+7];
            border = drawCommands[vIdx+8]; 
            
            set_pen_color t_color;
           
            _c "//3. DRAW trapezoid";
            #set_pen_transparency 50;
            #QuadFiller rx1, ceil_y1, rx1, floor_y1, rx2, floor_y2, rx2, ceil_y2;
            if abs(ceil_y1 - floor_y1 ) > abs(ceil_y2 - floor_y2) {
                trapezoid rx1, rx2, ceil_y1, floor_y1, floor_y2, ceil_y2, 1;
            } else {
                trapezoid rx2, rx1, ceil_y2, floor_y2, floor_y1, ceil_y1, 1;
            }
            if (border==1){
                _c "//Solid Structural Outline";
                set_pen_color "#000000";
                set_pen_size 1;
                goto rx1, ceil_y1; pen_down; goto rx1, floor_y1; 
                goto rx2, floor_y2; goto rx2, ceil_y2; goto rx1, ceil_y1; pen_up;
                drawCount += 5;
            }

            vIdx += 9;
        } elif cmd == "quad" {
            _c "# Trapezoid token + (x1, y1, x2, y2, x3, y3, x4, y4, color, border) = 11 elements";
            # Extract the projected coordinates and color
            rx1 = drawCommands[vIdx+1];
            ry1 = drawCommands[vIdx+2];
            rx2 = drawCommands[vIdx+3];
            ry2 = drawCommands[vIdx+4];
            rx3 = drawCommands[vIdx+5];
            ry3 = drawCommands[vIdx+6];
            rx4 = drawCommands[vIdx+7];
            ry4 = drawCommands[vIdx+8];
            
            t_color = drawCommands[vIdx+9];
            border = drawCommands[vIdx+10]; 
            
            set_pen_color t_color;
           
            _c "//3. DRAW quad";
            #set_pen_transparency 50;
            QuadFiller rx1, ry1, rx2, ry2, rx3, ry3, rx4, ry4;

            if (border==1){
                _c "//Solid Structural Outline";
                set_pen_color "#000000";
                set_pen_size 1;
                goto rx1, ry1; 
                pen_down; 
                goto rx1, ry1; 
                goto rx2, ry2; 
                goto rx3, ry3; 
                goto rx4, ry4;
                goto rx1, ry1; 
                pen_up;
                drawCount += 5;
            }

            vIdx += 11;
        } elif cmd == "drawEntity" {
            _c "# legacy circle path (types 2, 3): token + (type, sx, sy, radius, z) = 6 elements";
            ent_type = drawCommands[vIdx + 1];
            ent_sx = drawCommands[vIdx + 2];
            ent_sy = drawCommands[vIdx + 3];
            ent_rad  = drawCommands[vIdx + 4];
            set_pen_transparency 0;
            set_pen_size ent_rad * 2;
            if ent_type == 1 { set_pen_color "#ff3366"; } else { set_pen_color "#00ffcc"; }
            set_size 1/0;
            pen_up; goto ent_sx, ent_sy - ent_rad; pen_down; goto ent_sx, ent_sy - ent_rad; pen_up;
            drawCount += 1;
            vIdx += 6;
        } else {
            vIdx += 1;
        }
    }

}

# =================================================================
# --- ELLIPSE PRIMITIVE (barrel lid / bung) -----------------------
# =================================================================
proc ellispe stepsize, circles, _2h, w_h {
    set_pen_size $_2h;
    pen_down;
    pen_up;
    r = $stepsize;
    i3 = 0;
    repeat $circles {
        set_pen_size $_2h * sqrt(1 - r * r / $w_h);
        r += -2 * $stepsize / ($circles * 2);
        move -2 * $stepsize / ($circles * 2) * ($circles - i3);
        pen_down;
        move 4 * $stepsize / ($circles * 2) * ($circles - i3);
        pen_up;
        move -2 * $stepsize / ($circles * 2) * ($circles - i3);
        i3 += 1;
    }
    drawCount += i3;
}

proc draw_ellipse x, y, w, h, dir {
    goto $x, $y;
    point_in_direction $dir;
    if $w > $h {
        ellispe $w - $h * $h / $w, ($w - $h) / ($w + $h) * ($w / 2) + 1, 2 * $h, $w * $w - $h * $h;
    }
    else {
        turn_right 90;
        ellispe $h - $w * $w / $h, ($h - $w) / ($h + $w) * ($h / 2) + 1, 2 * $w, $h * $h - $w * $w;
    }
}

proc drawWallShader startIdx, worldCeilY, worldFloorY {
    vIdx = $startIdx;
    maxLen=length(drawCommands);
    if (drawCommands[vIdx] == "EoW") {stop_this_script;}
    _c "//--- PHASE 1: STAMPS (Vertical Lines/Dashes) ---";
    point_in_direction  90 ;
    until drawCommands[vIdx] == "EoL" or vIdx > maxLen {
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
        until drawCommands[vIdx] == "EoL" or vIdx > maxLen {
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
            until drawCommands[vIdx] == "EoL" or vIdx > maxLen {
                pen_down; 
                move drawCommands[vIdx]; 
                pen_up;
                move drawCommands[vIdx+1]; 
                drawCount += 1;
                vIdx += 2;
            } 
        } else { 
            until drawCommands[vIdx] == "EoL" or vIdx > maxLen {
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


    until drawCommands[vIdx] == "EoW" or vIdx > maxLen {

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
        _c "// GUARD: If p is exactly 0, ln(p) is 0, causing Infinity loops. Force above 0.";
        if p <= 0.05 { p = 0.05; }

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

proc QuadFiller x1, y1, x2, y2, x3, y3, x4, y4 {
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


proc  _c comment {}
