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

# Screen Projection
var sx1; var sx2; var sy; var radius;

on "entityShader" {
    process_entities;
}


proc process_entities {
    _c "#Process entities and append to drawCommands";    
    focalLength = "vectorRooms"."focalLength";
   
    i = 1;
    ent_count=length(frameEntity)/8 ;
    repeat ent_count {
        frameEntity[i + 7]=length(drawCommands) + 1;
        e_type = frameEntity[i];
        e_zAvg = frameEntity[i + 1];
        e_x1   = frameEntity[i + 2];
        e_z1   = frameEntity[i + 3];
        e_x2   = frameEntity[i + 4];
        e_z2   = frameEntity[i + 5];
        e_roomId   = frameEntity[i + 6];
        e_drawIdx   = frameEntity[i + 7];
        
        _c "# Project 3D bounds to Screen X";
        sx1 = (e_x1 / e_z1) * focalLength;
        sx2 = (e_x2 / e_z2) * focalLength;
        
        _c "# Project World Y to Screen Y (Assuming entities sit on the floor)";
        _c "# Using a standard 120 offset for the floor";
        sy = 120 / e_zAvg;
        
        _c "# Check 1D Span Buffer Occlusion";
        _c "# Map screen X to the 1..481 array index";
        span_idx = round((sx1 + sx2) / 2) + 241;
        
        _c "# If span_idx is valid, and the entity is IN FRONT of the wall at that pixel";
        if span_idx > 0 and span_idx < 482 {

            _c "create entity drawCommands for each entity type found";            
            if e_type == 1 {
                drawCircle;
            }            
        }
        
        i += 8;
    }
    add "EoL" to drawCommands;
}

proc drawCircle {
    _c "# Compare against the frameCount marker in span_buffer (or a Z-buffer if you implement one)";
    _c "# For now, if the entity is visible, we calculate its radius and emit the command";
    
    radius = abs(sx2 - sx1) / 2;
    
    _c "# Push to drawCommands queue";
    add "drawEntity" to drawCommands;
    add e_type to drawCommands;
    add round((sx1 + sx2) / 2) to drawCommands; # Screen X Center
    add sy to drawCommands;                     # Screen Y Bottom
    add radius to drawCommands;                 # Screen Radius
    add e_zAvg to drawCommands;                 # Depth for shading
}

proc _c comment {}