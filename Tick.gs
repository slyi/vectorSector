hide;
costumes "assets/efa1619e.svg" as "costume1";

var fpslasttime = 0;

list stats =[];


onflag {
    fpslasttime = 0;
    show stats;

    forever {                
        erase_all;
        broadcast "_2.5DEngine";
        broadcast "wallShader";
        
        broadcast "renderFloor";
        broadcast "renderWalls";
        Tick fpslasttime;
    }
    
}

proc Tick lasttime {
    
    delete stats;
    fps = round(1 / (timer() - $lasttime));
    fpslasttime = timer();
    if fps > 30 {
        fps = 30;
    }
    if fps > 0 and round(timer() * 100) % 7.5 == 0 {
        fps = fps;
    }

    floorDrawCount = "floorShader"."drawCount";
    floorRenderTime = "floorShader"."renderTimeFloor";

    
    add ("FPS:" & fps) to stats;
    add ("3dtime:" & "vectorRooms"."_3dTime" ) to stats;
    add ("Shader:" & "wallShader"."shaderTime" ) to stats;
    add ("render:" & "renderFrame"."renderTime" ) to stats;
    add ("wdraw:" & "renderFrame"."drawCount" ) to stats; 
    add ("floor:" & floorRenderTime ) to stats;
    add ("fdraw:" & floorDrawCount) to stats;   

    
}

proc _c comment {}
