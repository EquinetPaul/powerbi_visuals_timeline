/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

import * as d3 from "d3";

import { VisualFormattingSettingsModel } from "./settings";

interface Data {
    date: string;
    dateDisplay: string;
    event: string;
    eventDisplay: string;
    description: string;
    colorAttribute: string;
    color: string;
    symbolAttribute: string;
    symbol: string;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    private data: Data[];

    private colorScale: d3.ScaleOrdinal<string, string>;
    private symbolScale: d3.ScaleOrdinal<string, string>;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;

        this.data = []

        // Initialisation des scales
        this.colorScale = d3.scaleOrdinal();
        this.symbolScale = d3.scaleOrdinal();

    }

    public update(options: VisualUpdateOptions) {
        // Appel à la fonction de transformation des données
        this.data = this.transformData(options.dataViews[0].table);
    
        // Récupération des dimensions du conteneur
        const width = options.viewport.width;
        const height = options.viewport.height;
    
        // Nettoyer le contenu précédent du visuel
        d3.select(this.target).selectAll("*").remove();
    
        // Créer un SVG pour dessiner la timeline
        const svg = d3.select(this.target)
            .append("svg")
            .attr("width", width)
            .attr("height", height);
    
        // Déterminer les limites (min/max) des dates
        const minDate = d3.min(this.data, d => new Date(d.date));
        const maxDate = d3.max(this.data, d => new Date(d.date));
    
        // Créer une échelle temporelle
        const timeScale = d3.scaleTime()
            .domain([minDate, maxDate])
            .range([50, width - 50]);  // On laisse 50px de marge de chaque côté
    
        // Position verticale de la timeline
        const timelineY = height / 2;
    
        // Ajouter une ligne horizontale pour représenter la timeline
        svg.append("line")
            .attr("x1", 50)
            .attr("x2", width - 50)
            .attr("y1", timelineY)
            .attr("y2", timelineY)
            .attr("stroke", "#000")  // Couleur de la ligne
            .attr("stroke-width", 2);  // Épaisseur de la ligne
    
        this.basicTimeline(svg, timeScale, timelineY)
        
    }
    
    public basicTimeline(svg, timeScale, timelineY) {
        const groupedData = d3.group(this.data, d => d.date);
    
        // Ajouter un div pour le tooltip
        const tooltip = d3.select(this.target)
            .append("div")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("border", "1px solid black")
            .style("padding", "8px")
            .style("border-radius", "5px")
            .style("font-size", "12px");
    
        // Ajouter un cercle pour chaque date distincte
        groupedData.forEach((events, date) => {
            const baseX = timeScale(new Date(date));
    
            const circleGroup = svg.append("g");
    
            // Ajouter un cercle pour la date
            const circle = circleGroup.append("circle")
                .attr("cx", baseX)  // Position x basée sur la date
                .attr("cy", timelineY)  // Position y centrée sur la timeline
                .attr("r", 5)  // Rayon du cercle
                .attr("fill", "#000")  // Couleur par défaut (noir)
                .attr("stroke", "#000")  // Contour du cercle
                .attr("stroke-width", 2)  // Épaisseur du contour
                .on("mouseover", function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 8)  // Agrandir le cercle
                        .attr("stroke", "red")  // Ajouter le cercle rouge
                        .attr("stroke-width", 3);
    
                    // Mettre à jour et afficher le tooltip
                    tooltip.html(events.map(e => `<b>Date:</b> ${e.dateDisplay}<br/><b>Event:</b> ${e.eventDisplay}<br/><b>Description:</b> ${e.description}`).join("<br/><br/>"))
                        .style("visibility", "visible");
                })
                .on("mousemove", function(event) {
                    tooltip.style("top", (event.pageY + 15) + "px")
                        .style("left", (event.pageX + 15) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 5)  // Rétrécir le cercle
                        .attr("stroke", "#000")  // Restaurer la couleur noire
                        .attr("stroke-width", 2);
    
                    // Cacher le tooltip
                    tooltip.style("visibility", "hidden");
                });
        });
    }
    

    public transformData(table: powerbi.DataViewTable): Data[] {
        const data: Data[] = [];

        const rows = table.rows;

        let idColumns = {
            "Date": null,
            "Event": null,
            "Description": null,
            "Color": null,
            "Symbol": null,
        };

        table.columns.forEach((column, i) => {
            const role = column.roles;

            if (role.Date) {
                idColumns["Date"] = i;
            }
            if (role.Event) {
                idColumns["Event"] = i;
            }
            if (role.Description) {
                idColumns["Description"] = i;
            }
            if (role.Color) {
                idColumns["Color"] = i;
            }
            if (role.Symbol) {
                idColumns["Symbol"] = i;
            }
        });

        rows.forEach(row => {
            const date = row[idColumns["Date"]].toString();
            const dateDisplay = formatDate(date);
            const event = row[idColumns["Event"]].toString();
            const eventDisplay = formatStringDisplay(event);
            const description = row[idColumns["Description"]].toString();
            const colorAttribute = row[idColumns["Color"]].toString();
            const symbolAttribute = row[idColumns["Symbol"]].toString();
            const color = idColumns["Color"] !== null ? this.colorScale(row[idColumns["Color"]].toString()) : "#000000";
            const symbol = idColumns["Symbol"] !== null ? this.symbolScale(row[idColumns["Symbol"]].toString()) : "circle";

            const item: Data = {
                date: idColumns["Date"] !== null ? date : "",
                dateDisplay: dateDisplay,
                event: idColumns["Event"] !== null ? event : "",
                eventDisplay: idColumns["Event"] !== null ? eventDisplay : "",
                description: description,
                color: color,
                colorAttribute: colorAttribute,
                symbol: symbol,
                symbolAttribute: symbolAttribute
            };

            data.push(item);
        });

        console.log(data);

        return data;
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

}

function formatDate(isoDate) {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Les mois sont indexés à partir de 0
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

function formatStringDisplay(input) {
    if (input.length <= 10) {
        return input;
    } else {
        return input.substring(0, 7) + '...';
    }
}

function generateSymbol(symbolName: string): string {
    const symbolGenerator = d3.symbol();
    let symbolType;

    // Mapper les noms aux types de symboles d3
    switch (symbolName) {
        case 'circle':
            symbolType = d3.symbolCircle;
            break;
        case 'square':
            symbolType = d3.symbolSquare;
            break;
        case 'triangle':
            symbolType = d3.symbolTriangle;
            break;
        case 'diamond':
            symbolType = d3.symbolDiamond;
            break;
        case 'cross':
            symbolType = d3.symbolCross;
            break;
        case 'star':
            symbolType = d3.symbolStar;
            break;
        case 'wye':
            symbolType = d3.symbolWye;
            break;
        default:
            symbolType = d3.symbolCircle;  // Par défaut
    }

    // Générer et retourner le chemin SVG du symbole
    return symbolGenerator.type(symbolType)();
}