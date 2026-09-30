export const getCurrentTrimester = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ajustar a medianoche para comparaciones seguras
    const year = today.getFullYear();

    // Límites de trimestres en el año actual (Meses indexados en 0: Ene=0, Feb=1, May=4, Ago=7, Sep=8, Dic=11)
    const t1Start = new Date(year, 1, 2);   // 2 de Feb
    const t1End = new Date(year, 4, 8);     // 8 de May

    const t2Start = new Date(year, 4, 9);   // 9 de May
    const t2End = new Date(year, 7, 31);    // 31 de Ago

    const t3Start = new Date(year, 8, 1);   // 1 de Sep
    const t3End = new Date(year, 11, 4);    // 4 de Dic

    if (today < t1Start) {
        return 1;
    } else if (today >= t1Start && today <= t1End) {
        return 1;
    } else if (today >= t2Start && today <= t2End) {
        return 2;
    } else if (today >= t3Start && today <= t3End) {
        return 3;
    } else {
        return 3;
    }
};
