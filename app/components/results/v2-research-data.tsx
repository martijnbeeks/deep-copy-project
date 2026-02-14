"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/results/markdown-content";
import { EditableProductDetails } from "@/lib/db/types";
import {
    FileText,
    Brain,
    Sparkles,
    Compass,
    Lightbulb,
    Package,
    HeartCrack,
    Trophy,
    ShieldAlert,
    BookOpen,
    XCircle,
    Quote,
    ArrowRight,
    Target,
    Users,
    Megaphone,
    DollarSign,
    CreditCard,
    Shield,
    Truck,
    AlertCircle,
    CheckCircle,
    Award,
    AlertTriangle,
    Layers,
    ChevronDown,
    ChevronUp,
    Edit
} from "lucide-react";

interface V2ResearchDataProps {
    fullResult: any;
    jobId: string;
}

// Component for expandable lists (max 2 items initially)
function ExpandableList({ items, uniqueKey }: { items: string[] | undefined; uniqueKey: string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!items || items.length === 0) {
        return <span className="text-muted-foreground/30 italic text-xs">N/A</span>;
    }

    const maxInitialItems = 2;
    const hasMore = items.length > maxInitialItems;
    const displayItems = isExpanded ? items : items.slice(0, maxInitialItems);

    return (
        <div className="space-y-2">
            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1 marker:text-primary">
                {displayItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                ))}
            </ul>
            {hasMore && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    {isExpanded ? "Show Less" : `Show More (${items.length - maxInitialItems} more)`}
                </Button>
            )}
        </div>
    );
}

export function V2ResearchData({ fullResult, jobId }: V2ResearchDataProps) {
    // Constants
    const TOTAL_SOPHISTICATION_LEVELS = 5; // Total number of sophistication levels (can be changed easily)

    // State for accordion sections
    const [openSections, setOpenSections] = useState<string[]>([]);
    
    // State for editable product details
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editableProductDetails, setEditableProductDetails] = useState<EditableProductDetails>({});
    const [isLoadingProductDetails, setIsLoadingProductDetails] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    // All section values
    const allSections = [
        "section-market-snapshot",
        "section-product-details",
        "section-pain-desire",
        "section-failed-solutions",
        "section-competitor-landscape",
        "section-belief-architecture",
        "section-objections",
        "section-raw-language"
    ];

    if (!fullResult?.results) {
        return null;
    }

    const results = fullResult.results;
    const offerBrief = results.offer_brief;
    const marketingAvatars = results.marketing_avatars || [];

    // Fetch editable product details on component mount
    useEffect(() => {
        const fetchEditableProductDetails = async () => {
            try {
                const response = await fetch(`/api/jobs/${jobId}/product-details`);
                const data = await response.json();
                // Set the data even if it's null - this ensures we have the correct state
                setEditableProductDetails(data.editableProductDetails || { is_confirmed: false });
            } catch (error) {
                console.error('Error fetching editable product details:', error);
            } finally {
                setIsLoadingProductDetails(false);
            }
        };

        if (jobId) {
            fetchEditableProductDetails();
        }
    }, [jobId]);

    // Handler to save product details
    const handleSaveProductDetails = async () => {
        setIsSaving(true);
        setSaveMessage('');
        
        try {
            const response = await fetch(`/api/jobs/${jobId}/product-details`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productDetails: editableProductDetails
                }),
            });

            if (response.ok) {
                setSaveMessage('Product details saved successfully!');
                setTimeout(() => setSaveMessage(''), 3000);
                setIsEditingProduct(false); // Exit edit mode after successful save
            } else {
                setSaveMessage('Failed to save product details');
            }
        } catch (error) {
            console.error('Error saving product details:', error);
            setSaveMessage('Error saving product details');
        } finally {
            setIsSaving(false);
        }
    };

    // Handler to cancel editing and reset to original data
    const handleCancelProductDetails = () => {
        // Reset editable product details to original data
        if (offerBrief?.product) {
            setEditableProductDetails({
                product_name: offerBrief.product.name,
                product_format: offerBrief.product.format,
                price: offerBrief.product.price,
                subscription_price: offerBrief.product.subscription_price,
                guarantee: offerBrief.product.guarantee,
                shipping: offerBrief.product.shipping,
                description: offerBrief.product.description,
                details: offerBrief.product.details,
                key_differentiator: offerBrief.product.key_differentiator,
                compliance_notes: offerBrief.product.compliance_notes,
                is_confirmed: false,
                updated_at: new Date().toISOString()
            });
        }
        setIsEditingProduct(false);
        setSaveMessage('');
    };

    // Handler to confirm product details
    const handleConfirmProductDetails = async () => {
        try {
            const response = await fetch(`/api/jobs/${jobId}/product-details/confirm`, {
                method: 'POST',
            });

            if (response.ok) {
                setSaveMessage('Product details confirmed successfully!');
                setTimeout(() => setSaveMessage(''), 3000);
                // Update local state to reflect confirmation
                setEditableProductDetails(prev => ({
                    ...prev,
                    is_confirmed: true
                }));
            } else {
                setSaveMessage('Failed to confirm product details');
            }
        } catch (error) {
            console.error('Error confirming product details:', error);
            setSaveMessage('Error confirming product details');
        }
    };

    // Handler to close accordion when clicking on content (but not on interactive elements)
    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>, sectionValue: string) => {
        // Check if the click target is an interactive element
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button, a, input, select, textarea, [role="button"], [onclick], [data-interactive]');

        // If clicking on interactive element, don't close
        if (isInteractive) {
            return;
        }

        // Close the accordion by removing this section from open sections
        if (openSections.includes(sectionValue)) {
            setOpenSections(openSections.filter(v => v !== sectionValue));
        }
    };

    // Handler to expand all sections
    const handleExpandAll = () => {
        setOpenSections([...allSections]);
    };

    // Handler to close all sections
    const handleCloseAll = () => {
        setOpenSections([]);
    };

    // Helper to render a key-value row with optional label styling
    const renderField = (label: string, value: any, className = "col-span-1") => (
        <div className={`space-y-1.5 ${className}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide opacity-70">
                {label}
            </p>
            <div className="text-sm font-medium text-foreground leading-relaxed">
                {value ? (
                    <span className="whitespace-pre-wrap">{value}</span>
                ) : (
                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                )}
            </div>
        </div>
    );

    // Helper to render arrays
    const renderList = (items: string[] | undefined) => {
        if (!items || items.length === 0) return <span className="text-muted-foreground/30 italic text-xs">N/A</span>;
        return (
            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                {items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                ))}
            </ul>
        );
    };


    // Helper for Section Headers to match wireframe style
    const SectionHeader = ({ 
        icon: Icon, 
        title, 
        className = "", 
        isAccordion = false, 
        showIndicator = false 
    }: { 
        icon: any, 
        title: string, 
        className?: string, 
        isAccordion?: boolean,
        showIndicator?: boolean
    }) => (
        <div className={`flex items-center gap-3 ${!isAccordion ? 'border-b border-border/60 bg-muted/20 px-6 py-4' : ''} ${className}`}>
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                {title}
                {showIndicator && <AlertCircle className="h-4 w-4 text-red-500" />}
            </h3>
        </div>
    );

    const renderQuoteList = (quotes: any[] | undefined) => {
        if (!quotes || quotes.length === 0) return null;
        return (
            <div className="space-y-3">
                {quotes.map((quoteObj, idx) => (
                    <div key={idx} className="bg-card p-4 rounded-lg border border-border/50 text-sm">
                        <div className="flex items-start gap-3">
                            <Quote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="italic text-foreground/90 leading-relaxed">{quoteObj.quote}</div>
                                {quoteObj.source && (
                                    <div className="text-xs text-muted-foreground">— {quoteObj.source}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="animate-in fade-in duration-500">
            {!offerBrief && marketingAvatars.length === 0 && (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        No detailed research data available in this result.
                    </CardContent>
                </Card>
            )}

            {offerBrief && (
                <div>
                    <Accordion type="single" collapsible>
                        <AccordionItem value="research-analysis">
                            <Card className="bg-card/80 border-border/50">
                                <AccordionTrigger className="p-8 hover:no-underline">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-primary-foreground" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                                    Market Overview
                                                    {!isLoadingProductDetails && !editableProductDetails.is_confirmed && (
                                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                                    )}
                                                </h2>
                                                <p className="text-sm text-muted-foreground">
                                                    Comprehensive market research, positioning strategy, and customer insights.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0">
                                    <div className="px-8 border-t border-border/50 pt-6">
                                        {/* All sections as Accordions */}
                                        <Accordion
                                            type="multiple"
                                            className="space-y-4"
                                            value={openSections}
                                            onValueChange={setOpenSections}
                                        >
                                            {/* 1. MARKET SNAPSHOT */}
                                            <AccordionItem value="section-market-snapshot" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={Compass} title="Market Snapshot" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-market-snapshot")}
                                                >
                                                    {/* Top Row: Sophistication, Awareness, Consciousness */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {/* Sophistication Card */}
                                                        <div className="border border-border/60 rounded-lg p-4 bg-muted/5">
                                                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                                MARKET SOPHISTICATION
                                                                {(() => {
                                                                    const levelStr = offerBrief.market_snapshot?.sophistication?.level || '';
                                                                    // Extract number from strings like "level_4" or just "4"
                                                                    const levelNum = parseInt(levelStr.toString().replace(/\D/g, '')) || 0;
                                                                    return levelNum > 0 ? (
                                                                        <span className="text-sm font-bold text-primary uppercase">LEVEL {levelNum}</span>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            <div className="mb-4">
                                                                {(() => {
                                                                    const levelStr = offerBrief.market_snapshot?.sophistication?.level || '';
                                                                    const levelNum = parseInt(levelStr.toString().replace(/\D/g, '')) || 0;
                                                                    return levelNum > 0 ? (
                                                                        <div className="space-y-3">
                                                                            {/* Ruler/Thermometer Base Line */}
                                                                            <div className="relative w-full h-1 bg-muted rounded-full">
                                                                                {/* Progress Fill */}
                                                                                <div
                                                                                    className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all"
                                                                                    style={{ width: `${(levelNum / TOTAL_SOPHISTICATION_LEVELS) * 100}%` }}
                                                                                />
                                                                                {/* Level Tick Marks */}
                                                                                <div className="absolute inset-0 flex justify-between items-center">
                                                                                    {Array.from({ length: TOTAL_SOPHISTICATION_LEVELS }, (_, idx) => {
                                                                                        const currentLevel = idx + 1;
                                                                                        const isActive = levelNum === currentLevel;
                                                                                        const position = (idx / (TOTAL_SOPHISTICATION_LEVELS - 1)) * 100;

                                                                                        return (
                                                                                            <div
                                                                                                key={idx}
                                                                                                className="absolute flex flex-col items-center"
                                                                                                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                                                                                            >
                                                                                                {/* Tick Mark */}
                                                                                                <div
                                                                                                    className={`transition-all duration-300 ${isActive
                                                                                                        ? 'w-1 h-6 bg-primary'
                                                                                                        : 'w-0.5 h-4 bg-muted-foreground/40'
                                                                                                        }`}
                                                                                                />
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                            {/* Level Labels */}
                                                                            <div className="relative flex justify-between px-1">
                                                                                {Array.from({ length: TOTAL_SOPHISTICATION_LEVELS }, (_, idx) => {
                                                                                    const currentLevel = idx + 1;
                                                                                    const isActive = levelNum === currentLevel;

                                                                                    return (
                                                                                        <div key={idx} className="flex flex-col items-center">
                                                                                            {/* Label */}
                                                                                            <div className={`text-xs whitespace-nowrap transition-all duration-300 mt-1 ${isActive
                                                                                                ? 'font-bold text-foreground scale-110'
                                                                                                : 'text-muted-foreground'
                                                                                                }`}>
                                                                                                {currentLevel}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground leading-relaxed">
                                                                {offerBrief.market_snapshot?.sophistication?.rationale || 'N/A'}
                                                            </div>
                                                        </div>

                                                        {/* Awareness Card */}
                                                        <div className="border border-border/60 rounded-lg p-4 bg-muted/5">
                                                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                                MARKET AWARENESS
                                                                {offerBrief.market_snapshot?.awareness && (
                                                                    <span className="text-sm font-bold text-primary uppercase">{offerBrief.market_snapshot.awareness}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground leading-relaxed">
                                                                {offerBrief.market_snapshot?.awareness_description || 'N/A'}
                                                            </div>
                                                        </div>

                                                        {/* Consciousness Card */}
                                                        <div className="border border-border/60 rounded-lg p-4 bg-muted/5">
                                                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                                MARKET CONSCIOUSNESS
                                                                {offerBrief.market_snapshot?.consciousness && (
                                                                    <span className="text-sm font-bold text-primary uppercase">{offerBrief.market_snapshot.consciousness}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground leading-relaxed">
                                                                {offerBrief.market_snapshot?.consciousness_description || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Market Temperature Section */}
                                                    <div className="border border-border/60 rounded-lg p-6 bg-muted/5">
                                                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-6">
                                                            MARKET TEMPERATURE
                                                        </div>

                                                        {/* Horizontal Thermometer Gauge */}
                                                        <div className="flex flex-col items-center justify-center mb-6">
                                                            <div className="relative w-full max-w-2xl">
                                                                {/* Ruler/Thermometer Base Line */}
                                                                <div className="relative w-full h-2 rounded-full overflow-visible bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 shadow-inner">
                                                                    {/* Gauge glow effect */}
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-yellow-500/20 to-red-500/20 blur-sm" />
                                                                    {/* Temperature Tick Marks */}
                                                                    <div className="absolute inset-0 flex justify-between items-center">
                                                                        {['Cold', 'Skeptical', 'Warm', 'Hot', 'Saturated'].map((temp, idx) => {
                                                                            const currentTemp = offerBrief.market_snapshot?.market_temperature || '';
                                                                            const isActive = currentTemp.toLowerCase() === temp.toLowerCase();
                                                                            const position = (idx / 4) * 100; // 4 intervals for 5 items

                                                                            // Color mapping for each temperature - using shades of black
                                                                            const colorMap: Record<string, string> = {
                                                                                'Cold': 'bg-gray-400',
                                                                                'Skeptical': 'bg-gray-500',
                                                                                'Warm': 'bg-gray-600',
                                                                                'Hot': 'bg-gray-700',
                                                                                'Saturated': 'bg-gray-900'
                                                                            };

                                                                            return (
                                                                                <div
                                                                                    key={idx}
                                                                                    className="absolute flex flex-col items-center"
                                                                                    style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                                                                                >
                                                                                    {/* Tick Mark */}
                                                                                    <div
                                                                                        className={`transition-all duration-300 ${isActive
                                                                                            ? `w-1 h-8 ${colorMap[temp]} shadow-lg ring-1 ring-white/30`
                                                                                            : 'w-0.5 h-5 bg-gray-400/60 border border-gray-400/30'
                                                                                            }`}
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                                {/* Temperature Labels */}
                                                                <div className="relative w-full mt-4">
                                                                    {['Cold', 'Skeptical', 'Warm', 'Hot', 'Saturated'].map((temp, idx) => {
                                                                        const currentTemp = offerBrief.market_snapshot?.market_temperature || '';
                                                                        const isActive = currentTemp.toLowerCase() === temp.toLowerCase();
                                                                        const position = (idx / 4) * 100; // 4 intervals for 5 items

                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="absolute flex flex-col items-center"
                                                                                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                                                                            >
                                                                                {/* Label */}
                                                                                <div className={`text-sm whitespace-nowrap transition-all duration-300 ${isActive
                                                                                    ? 'font-bold text-foreground scale-110'
                                                                                    : 'text-muted-foreground'
                                                                                    }`}>
                                                                                    {temp}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Temperature Description Card */}
                                                        <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                                                            <div className="text-xs text-muted-foreground leading-relaxed">
                                                                <span className="font-bold text-foreground text-sm">
                                                                    {offerBrief.market_snapshot?.market_temperature || 'N/A'}
                                                                </span>
                                                                <span className="text-muted-foreground/50 mx-2">—</span>
                                                                <span className="text-foreground/80">
                                                                    {offerBrief.market_snapshot?.market_temperature_description || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                            {/* 2. PRODUCT DETAILS */}
                                            <AccordionItem value="section-product-details" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader 
                                                        icon={Package} 
                                                        title="Product Details" 
                                                        isAccordion 
                                                        showIndicator={!isLoadingProductDetails && !editableProductDetails.is_confirmed}
                                                    />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6"
                                                >
                                                    {/* Edit Controls */}
                                                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                                                        <div className="flex items-center gap-2">
                                                            <Edit className="h-4 w-4 text-primary" />
                                                            <span className="text-sm font-medium text-foreground">
                                                                {isEditingProduct ? 'Editing Product Details' : 'Product Details'}
                                                            </span>
                                                            {editableProductDetails.is_confirmed && (
                                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {!isEditingProduct ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setIsEditingProduct(true);
                                                                    }}
                                                                    disabled={editableProductDetails.is_confirmed}
                                                                >
                                                                    <Edit className="h-4 w-4 mr-2" />
                                                                    Edit
                                                                </Button>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCancelProductDetails();
                                                                        }}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        variant="default"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSaveProductDetails();
                                                                        }}
                                                                        disabled={isSaving}
                                                                    >
                                                                        {isSaving ? 'Saving...' : 'Save'}
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {!isEditingProduct && !isLoadingProductDetails && !editableProductDetails.is_confirmed && (
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleConfirmProductDetails();
                                                                    }}
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Confirm
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {saveMessage && (
                                                        <div className={`p-3 rounded-lg text-sm ${saveMessage.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                            {saveMessage}
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Product Name */}
                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Package className="h-4 w-4 text-blue-500" />
                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Product Name</h4>
                                                            </div>
                                                            <div className="text-sm text-foreground/80 leading-relaxed">
                                                                {isEditingProduct ? (
                                                                    <Input
                                                                        value={editableProductDetails.product_name || offerBrief.product?.name || ''}
                                                                        onChange={(e) => setEditableProductDetails(prev => ({
                                                                            ...prev,
                                                                            product_name: e.target.value
                                                                        }))}
                                                                        placeholder="Enter product name"
                                                                        className="text-sm"
                                                                    />
                                                                ) : (
                                                                    <span className="whitespace-pre-wrap">
                                                                        {editableProductDetails.product_name || offerBrief.product?.name || 'N/A'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Format */}
                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <FileText className="h-4 w-4 text-indigo-500" />
                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Format</h4>
                                                            </div>
                                                            <div className="text-sm text-foreground/80 leading-relaxed">
                                                                {isEditingProduct ? (
                                                                    <Input
                                                                        value={editableProductDetails.product_format || offerBrief.product?.format || ''}
                                                                        onChange={(e) => setEditableProductDetails(prev => ({
                                                                            ...prev,
                                                                            product_format: e.target.value
                                                                        }))}
                                                                        placeholder="Enter format"
                                                                        className="text-sm"
                                                                    />
                                                                ) : (
                                                                    <span className="whitespace-pre-wrap">
                                                                        {editableProductDetails.product_format || offerBrief.product?.format || 'N/A'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Price, Subscription Price, Guarantee, Shipping in clean boxes with icons */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {/* Price */}
                                                        <div className="p-4 rounded-lg bg-emerald-500/3 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <DollarSign className="h-4 w-4 text-emerald-500" />
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</span>
                                                            </div>
                                                            <div className="text-sm font-medium text-foreground">
                                                                {isEditingProduct ? (
                                                                    <Input
                                                                        value={editableProductDetails.price || offerBrief.product?.price || ''}
                                                                        onChange={(e) => setEditableProductDetails(prev => ({
                                                                            ...prev,
                                                                            price: e.target.value
                                                                        }))}
                                                                        placeholder="Enter price"
                                                                        className="text-sm"
                                                                    />
                                                                ) : (
                                                                    editableProductDetails.price || offerBrief.product?.price || 'N/A'
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Subscription Price */}
                                                        <div className="p-4 rounded-lg bg-blue-500/3 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <CreditCard className="h-4 w-4 text-blue-500" />
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription Price</span>
                                                            </div>
                                                            <div className="text-sm font-medium text-foreground">
                                                                {isEditingProduct ? (
                                                                    <Input
                                                                        value={editableProductDetails.subscription_price || offerBrief.product?.subscription_price || ''}
                                                                        onChange={(e) => setEditableProductDetails(prev => ({
                                                                            ...prev,
                                                                            subscription_price: e.target.value
                                                                        }))}
                                                                        placeholder="Enter subscription price"
                                                                        className="text-sm"
                                                                    />
                                                                ) : (
                                                                    editableProductDetails.subscription_price || offerBrief.product?.subscription_price || 'N/A'
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Guarantee */}
                                                        <div className="p-4 rounded-lg bg-amber-500/3 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Shield className="h-4 w-4 text-amber-500" />
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guarantee</span>
                                                            </div>
                                                            <div className="text-sm font-medium text-foreground">
                                                                {isEditingProduct ? (
                                                                    <Input
                                                                        value={editableProductDetails.guarantee || offerBrief.product?.guarantee || ''}
                                                                        onChange={(e) => setEditableProductDetails(prev => ({
                                                                            ...prev,
                                                                            guarantee: e.target.value
                                                                        }))}
                                                                        placeholder="Enter guarantee"
                                                                        className="text-sm"
                                                                    />
                                                                ) : (
                                                                    editableProductDetails.guarantee || offerBrief.product?.guarantee || 'N/A'
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Shipping */}
                                                        <div className="p-4 rounded-lg bg-purple-500/3 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Truck className="h-4 w-4 text-purple-500" />
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping</span>
                                                            </div>
                                                            <div className="text-sm font-medium text-foreground">
                                                                {isEditingProduct ? (
                                                                    <Input
                                                                        value={editableProductDetails.shipping || offerBrief.product?.shipping || ''}
                                                                        onChange={(e) => setEditableProductDetails(prev => ({
                                                                            ...prev,
                                                                            shipping: e.target.value
                                                                        }))}
                                                                        placeholder="Enter shipping"
                                                                        className="text-sm"
                                                                    />
                                                                ) : (
                                                                    editableProductDetails.shipping || offerBrief.product?.shipping || 'N/A'
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <FileText className="h-4 w-4 text-teal-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Description</h4>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                            {isEditingProduct ? (
                                                                <Textarea
                                                                    value={editableProductDetails.description || offerBrief.product?.description || ''}
                                                                    onChange={(e) => setEditableProductDetails(prev => ({
                                                                        ...prev,
                                                                        description: e.target.value
                                                                    }))}
                                                                    placeholder="Enter description"
                                                                    className="text-sm min-h-[100px]"
                                                                />
                                                            ) : (
                                                                <span className="whitespace-pre-wrap">
                                                                    {editableProductDetails.description || offerBrief.product?.description || 'N/A'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Package className="h-4 w-4 text-orange-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Details</h4>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                            {isEditingProduct ? (
                                                                <Textarea
                                                                    value={editableProductDetails.details || offerBrief.product?.details || ''}
                                                                    onChange={(e) => setEditableProductDetails(prev => ({
                                                                        ...prev,
                                                                        details: e.target.value
                                                                    }))}
                                                                    placeholder="Enter details"
                                                                    className="text-sm min-h-[100px]"
                                                                />
                                                            ) : (
                                                                <span className="whitespace-pre-wrap">
                                                                    {editableProductDetails.details || offerBrief.product?.details || 'N/A'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Key Differentiator - Subtle Highlight */}
                                                    <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Target className="h-4 w-4 text-primary" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Key Differentiator</h4>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                            {isEditingProduct ? (
                                                                <Textarea
                                                                    value={editableProductDetails.key_differentiator || offerBrief.product?.key_differentiator || ''}
                                                                    onChange={(e) => setEditableProductDetails(prev => ({
                                                                        ...prev,
                                                                        key_differentiator: e.target.value
                                                                    }))}
                                                                    placeholder="Enter key differentiator"
                                                                    className="text-sm min-h-[100px]"
                                                                />
                                                            ) : (
                                                                <span className="whitespace-pre-wrap">
                                                                    {editableProductDetails.key_differentiator || offerBrief.product?.key_differentiator || 'N/A'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <ShieldAlert className="h-4 w-4 text-red-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Compliance Notes</h4>
                                                        </div>
                                                        {isEditingProduct ? (
                                                            <Textarea
                                                                value={Array.isArray(editableProductDetails.compliance_notes) 
                                                                    ? editableProductDetails.compliance_notes.join('\n') 
                                                                    : editableProductDetails.compliance_notes || ''}
                                                                onChange={(e) => setEditableProductDetails(prev => ({
                                                                    ...prev,
                                                                    compliance_notes: e.target.value.split('\n').filter(note => note.trim())
                                                                }))}
                                                                placeholder="Enter compliance notes (one per line)"
                                                                className="text-sm min-h-[100px]"
                                                            />
                                                        ) : (
                                                            (() => {
                                                                const notes = Array.isArray(editableProductDetails.compliance_notes) 
                                                                    ? editableProductDetails.compliance_notes 
                                                                    : (editableProductDetails.compliance_notes || offerBrief.product?.compliance_notes || []);
                                                                return notes && notes.length > 0 ? (
                                                                    <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                                                                        {notes.map((note: string, idx: number) => (
                                                                            <li key={idx}>{note}</li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <span className="text-muted-foreground/30 italic text-xs">No compliance notes available</span>
                                                                );
                                                            })()
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>


                                            {/* 4. PAIN & DESIRES */}
                                            <AccordionItem value="section-pain-desire" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={HeartCrack} title="Pain & Desires" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-pain-desire")}
                                                >
                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                        {/* Table Header */}
                                                        <div className="grid grid-cols-[180px_1fr_1fr] bg-muted/20 border-b border-border/50">
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <Layers className="h-4 w-4 text-blue-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Cluster Type</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <HeartCrack className="h-4 w-4 text-red-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Pain Clusters</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                <Sparkles className="h-4 w-4 text-amber-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Desire Clusters</span>
                                                            </div>
                                                        </div>

                                                        {/* Table Rows */}
                                                        <div className="divide-y divide-border/50">
                                                            {/* Surface Row */}
                                                            <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Surface</span>
                                                                </div>
                                                                <div className="px-5 py-4 border-r border-border/50">
                                                                    <ExpandableList items={offerBrief.pain_desire?.pain_clusters?.surface} uniqueKey="surface-pain" />
                                                                </div>
                                                                <div className="px-5 py-4">
                                                                    <ExpandableList items={offerBrief.pain_desire?.desire_clusters?.surface} uniqueKey="surface-desire" />
                                                                </div>
                                                            </div>

                                                            {/* Emotional Row */}
                                                            <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Emotional</span>
                                                                </div>
                                                                <div className="px-5 py-4 border-r border-border/50">
                                                                    <ExpandableList items={offerBrief.pain_desire?.pain_clusters?.emotional} uniqueKey="emotional-pain" />
                                                                </div>
                                                                <div className="px-5 py-4">
                                                                    <ExpandableList items={offerBrief.pain_desire?.desire_clusters?.emotional} uniqueKey="emotional-desire" />
                                                                </div>
                                                            </div>

                                                            {/* Identity Row */}
                                                            <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Identity</span>
                                                                </div>
                                                                <div className="px-5 py-4 border-r border-border/50">
                                                                    <ExpandableList items={offerBrief.pain_desire?.pain_clusters?.identity} uniqueKey="identity-pain" />
                                                                </div>
                                                                <div className="px-5 py-4">
                                                                    <ExpandableList items={offerBrief.pain_desire?.desire_clusters?.identity} uniqueKey="identity-desire" />
                                                                </div>
                                                            </div>

                                                            {/* Secret Row */}
                                                            <div className="grid grid-cols-[180px_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                <div className="px-5 py-4 border-r border-border/50 flex items-center">
                                                                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Secret</span>
                                                                </div>
                                                                <div className="px-5 py-4 border-r border-border/50">
                                                                    <ExpandableList items={offerBrief.pain_desire?.pain_clusters?.secret} uniqueKey="secret-pain" />
                                                                </div>
                                                                <div className="px-5 py-4">
                                                                    <ExpandableList items={offerBrief.pain_desire?.desire_clusters?.secret} uniqueKey="secret-desire" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Footer for Dominant Emotion */}
                                                        <div className="bg-muted/20 border-t border-border/50 p-4 px-6 flex items-center gap-2">
                                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Dominant Emotion:</span>
                                                            <span className="text-sm font-medium text-foreground">{offerBrief.pain_desire?.dominant_emotion || "N/A"}</span>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>


                                            {/* 5. FAILED SOLUTIONS */}
                                            <AccordionItem value="section-failed-solutions" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={XCircle} title="Failed Solutions" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-failed-solutions")}
                                                >
                                                    {/* Solutions Table */}
                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                        {/* Table Header */}
                                                        <div className="grid grid-cols-[1fr_1.2fr_1.2fr] bg-muted/20 border-b border-border/50">
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Solution</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Why It Failed</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                <Target className="h-4 w-4 text-emerald-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Our Opportunity</span>
                                                            </div>
                                                        </div>

                                                        {/* Table Rows */}
                                                        <div className="divide-y divide-border/50">
                                                            {offerBrief.failed_solutions?.solutions && offerBrief.failed_solutions.solutions.length > 0 ? (
                                                                offerBrief.failed_solutions.solutions.map((sol: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-[1fr_1.2fr_1.2fr] hover:bg-muted/5 transition-colors">
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm font-medium text-foreground leading-relaxed">{sol.solution || "N/A"}</p>
                                                                        </div>
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm text-foreground/80 leading-relaxed">{sol.why_it_failed || "N/A"}</p>
                                                                        </div>
                                                                        <div className="px-5 py-4">
                                                                            <p className="text-sm text-foreground/90 font-medium leading-relaxed">{sol.our_opportunity || "N/A"}</p>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="p-8 text-center text-muted-foreground text-sm italic">
                                                                    No structured solution comparison data available.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Money Already Spent */}
                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <DollarSign className="h-4 w-4 text-orange-500" />
                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Money Already Spent</h4>
                                                            </div>
                                                            <div className="text-sm text-foreground/80 leading-relaxed">
                                                                {offerBrief.failed_solutions?.money_already_spent ? (
                                                                    <span className="whitespace-pre-wrap">{offerBrief.failed_solutions.money_already_spent}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Belief About Failure */}
                                                        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Brain className="h-4 w-4 text-purple-500" />
                                                                <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Belief About Failure</h4>
                                                            </div>
                                                            <div className="text-sm text-foreground/80 leading-relaxed">
                                                                {offerBrief.failed_solutions?.belief_about_failure ? (
                                                                    <span className="whitespace-pre-wrap">{offerBrief.failed_solutions.belief_about_failure}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Current Coping */}
                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Shield className="h-4 w-4 text-blue-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Current Coping</h4>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                            {offerBrief.failed_solutions?.current_coping ? (
                                                                <span className="whitespace-pre-wrap">{offerBrief.failed_solutions.current_coping}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>


                                            {/* 6. COMPETITOR LANDSCAPE */}
                                            <AccordionItem value="section-competitor-landscape" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={Trophy} title="Competitor Landscape" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-competitor-landscape")}
                                                >
                                                    {/* Competitor Table */}
                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                        {/* Table Header */}
                                                        <div className="grid grid-cols-[200px_120px_1fr_1fr_1fr] bg-muted/20 border-b border-border/50">
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <Users className="h-4 w-4 text-blue-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Competitor</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center justify-center gap-2">
                                                                <DollarSign className="h-4 w-4 text-emerald-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Price</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <Megaphone className="h-4 w-4 text-purple-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Key Claim</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Weakness</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Complaints</span>
                                                            </div>
                                                        </div>

                                                        {/* Table Rows */}
                                                        <div className="divide-y divide-border/50">
                                                            {offerBrief.competitor_landscape?.competitors && offerBrief.competitor_landscape.competitors.length > 0 ? (
                                                                offerBrief.competitor_landscape.competitors.map((comp: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-[200px_120px_1fr_1fr_1fr] hover:bg-muted/5 transition-colors">
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm font-medium text-foreground">{comp.name || "N/A"}</p>
                                                                        </div>
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm text-foreground/80 text-center">{comp.price || "N/A"}</p>
                                                                        </div>
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm text-foreground/80 leading-relaxed">{comp.key_claim || "N/A"}</p>
                                                                        </div>
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm text-foreground/80 leading-relaxed">{comp.weakness || "N/A"}</p>
                                                                        </div>
                                                                        <div className="px-5 py-4">
                                                                            <p className="text-sm text-foreground/80 leading-relaxed">{comp.complaints || "N/A"}</p>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="p-8 text-center text-muted-foreground text-sm italic">
                                                                    Detailed competitor matrix not available.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Competitor Gaps & Our Advantages Table */}
                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                        {/* Table Header */}
                                                        <div className="grid grid-cols-2 bg-muted/20 border-b border-border/50">
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <XCircle className="h-4 w-4 text-red-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Competitor Gaps</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                <Trophy className="h-4 w-4 text-emerald-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Our Advantages</span>
                                                            </div>
                                                        </div>

                                                        {/* Table Rows */}
                                                        <div className="divide-y divide-border/50">
                                                            {(() => {
                                                                const gaps = offerBrief.competitor_landscape?.competitor_gaps || [];
                                                                const advantages = offerBrief.competitor_landscape?.our_advantages || [];
                                                                const maxRows = Math.max(gaps.length, advantages.length);

                                                                if (maxRows === 0) {
                                                                    return (
                                                                        <div className="grid grid-cols-2">
                                                                            <div className="px-5 py-4 text-center text-muted-foreground/30 italic text-xs border-r border-border/50">
                                                                                N/A
                                                                            </div>
                                                                            <div className="px-5 py-4 text-center text-muted-foreground/30 italic text-xs">
                                                                                N/A
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                return Array.from({ length: maxRows }).map((_, idx) => (
                                                                    <div key={idx} className="grid grid-cols-2 hover:bg-muted/5 transition-colors">
                                                                        <div className="px-5 py-4 text-sm text-foreground/80 leading-relaxed border-r border-border/50">
                                                                            {gaps[idx] || <span className="text-muted-foreground/30 italic text-xs">—</span>}
                                                                        </div>
                                                                        <div className="px-5 py-4 text-sm text-foreground/80 leading-relaxed">
                                                                            {advantages[idx] || <span className="text-muted-foreground/30 italic text-xs">—</span>}
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Positioning Statement */}
                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Target className="h-4 w-4 text-primary" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Positioning Statement</h4>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                            {offerBrief.competitor_landscape?.positioning_statement ? (
                                                                <span className="whitespace-pre-wrap">{offerBrief.competitor_landscape.positioning_statement}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>


                                            {/* 7. BELIEF ARCHITECTURE */}
                                            <AccordionItem value="section-belief-architecture" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={Brain} title="Belief Architecture" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-belief-architecture")}
                                                >
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-4">The Belief Chain</h4>
                                                        <div className="space-y-3">
                                                            {offerBrief.belief_architecture?.belief_chain && offerBrief.belief_architecture.belief_chain.length > 0 ? (
                                                                offerBrief.belief_architecture.belief_chain.map((belief: any, idx: number) => (
                                                                    <div key={idx} className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                                        <div className="bg-muted/20 px-4 py-2.5 border-b border-border/50">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-bold text-primary">{idx + 1}.</span>
                                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">{belief.belief_name || "BELIEF"}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="p-4 space-y-6">
                                                                            <div className="flex items-start gap-2">
                                                                                <div className="text-sm font-semibold text-red-400 uppercase tracking-wide flex-shrink-0 whitespace-nowrap self-start" style={{ textBox: "trim-both cap alphabetic" }}>FROM</div>
                                                                                <div className="text-sm text-foreground/80 leading-relaxed italic flex-1 min-w-0 self-start" style={{ textBox: "trim-both cap alphabetic" }}>
                                                                                    {belief.from_belief || "N/A"}</div>
                                                                            </div>
                                                                            <div className="flex items-start gap-2">
                                                                                <div className="text-sm font-bold text-green-400 uppercase tracking-wide flex-shrink-0 whitespace-nowrap self-start" style={{ textBox: "trim-both cap alphabetic" }}>TO</div>
                                                                                <div className="text-sm font-medium text-foreground leading-relaxed flex-1 min-w-0 self-start" style={{ textBox: "trim-both cap alphabetic" }}>{belief.to_belief || "N/A"}</div>
                                                                            </div>
                                                                            {belief.proof && (
                                                                                <div className="pt-4 border-t border-border/50">
                                                                                    <div className="flex items-start gap-2">
                                                                                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0 whitespace-nowrap self-start" style={{ textBox: "trim-both cap alphabetic" }}>PROOF</div>
                                                                                        <div className="text-sm text-foreground/80 leading-relaxed flex-1 min-w-0 self-start" style={{ textBox: "trim-both cap alphabetic" }}>{belief.proof}</div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="text-center text-muted-foreground italic text-sm p-4 bg-muted/20 rounded-lg border border-border/50">
                                                                    No belief chain data available
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Brain className="h-4 w-4 text-indigo-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">The Complete Argument</h4>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 leading-relaxed">
                                                            {offerBrief.belief_architecture?.complete_argument ? (
                                                                <span className="whitespace-pre-wrap">{offerBrief.belief_architecture.complete_argument}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>


                                            {/* 8. OBJECTIONS */}
                                            <AccordionItem value="section-objections" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={ShieldAlert} title="Objections" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-objections")}
                                                >
                                                    {/* Objections Table */}
                                                    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                                                        {/* Table Header */}
                                                        <div className="grid grid-cols-[0.7fr_100px_1.3fr] bg-muted/20 border-b border-border/50">
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center gap-2">
                                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Objections</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 border-r border-border/50 flex items-center justify-center gap-2">
                                                                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Severity</span>
                                                            </div>
                                                            <div className="px-5 py-3.5 flex items-center gap-2">
                                                                <Shield className="h-4 w-4 text-emerald-500" />
                                                                <span className="text-xs font-bold uppercase tracking-wide text-foreground">Response</span>
                                                            </div>
                                                        </div>

                                                        {/* Table Rows */}
                                                        <div className="divide-y divide-border/50">
                                                            {offerBrief.objections_section?.objections && offerBrief.objections_section.objections.length > 0 ? (
                                                                offerBrief.objections_section.objections.map((obj: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-[0.7fr_100px_1.3fr] hover:bg-muted/5 transition-colors">
                                                                        <div className="px-5 py-4 border-r border-border/50">
                                                                            <p className="text-sm italic text-foreground/80 leading-relaxed">"{obj.objection || 'N/A'}"</p>
                                                                        </div>
                                                                        <div className="px-5 py-4 border-r border-border/50 flex items-center justify-center">
                                                                            <span className={`text-sm font-bold ${obj.severity === 'high' ? 'text-red-500' :
                                                                                obj.severity === 'medium' ? 'text-yellow-500' :
                                                                                    'text-green-500'
                                                                                }`}>
                                                                                {obj.severity === 'high' ? '3' :
                                                                                    obj.severity === 'medium' ? '2' :
                                                                                        '1'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="px-5 py-4">
                                                                            <p className="text-sm text-foreground/80 leading-relaxed">{obj.response || 'N/A'}</p>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="p-8 text-center text-muted-foreground text-sm italic">
                                                                    No objections data available
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Hidden Objection */}
                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <XCircle className="h-4 w-4 text-red-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Hidden Objection</h4>
                                                        </div>
                                                        <div className="text-sm italic text-foreground/80 leading-relaxed pl-2">
                                                            "{offerBrief.objections_section?.hidden_objection || 'N/A'}"
                                                        </div>
                                                        <div className="pt-2 border-t border-border/50 mt-2">
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <span className="font-bold text-muted-foreground uppercase tracking-wide">Counter:</span>
                                                                <span className="text-foreground/80">{offerBrief.objections_section?.hidden_objection_counter || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>


                                            {/* 9. RAW CUSTOMER QUOTES & RESEARCH INSPIRATION */}
                                            <AccordionItem value="section-raw-language" className="border rounded-xl bg-card overflow-hidden shadow-sm border-border/60">
                                                <AccordionTrigger className="px-6 py-4 bg-muted/20 hover:bg-muted/30 hover:no-underline transition-colors border-b border-border/60">
                                                    <SectionHeader icon={BookOpen} title="Raw Customer Quotes & Research Inspiration" isAccordion />
                                                </AccordionTrigger>
                                                <AccordionContent
                                                    className="p-6 space-y-6 cursor-pointer"
                                                    onClick={(e) => handleContentClick(e, "section-raw-language")}
                                                >
                                                    {(() => {
                                                        // Get words from first marketing avatar if available
                                                        const firstAvatar = marketingAvatars?.[0]?.avatar?.raw_language;
                                                        const wordsTheyUse = firstAvatar?.words_they_use;
                                                        const wordsTheyAvoid = firstAvatar?.words_they_avoid;

                                                        // Get quotes and objections from offer_brief
                                                        const painQuotes = offerBrief?.research_inspiration?.raw_quotes?.pain_quotes;
                                                        const desireQuotes = offerBrief?.research_inspiration?.raw_quotes?.desire_quotes;
                                                        const objections = offerBrief?.objections;

                                                        return (
                                                            <>
                                                                {/* Quotes Section */}
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                    {/* Pain Quotes */}
                                                                    <div className="space-y-3 p-5 rounded-lg bg-muted/20 border border-border/50">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
                                                                                <HeartCrack className="h-4 w-4 text-red-500" />
                                                                            </div>
                                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Pain Quotes</h4>
                                                                        </div>
                                                                        {painQuotes && painQuotes.length > 0 ? (
                                                                            renderQuoteList(painQuotes)
                                                                        ) : (
                                                                            <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Desire Quotes */}
                                                                    <div className="space-y-3 p-5 rounded-lg bg-muted/20 border border-border/50">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                                                                                <Sparkles className="h-4 w-4 text-amber-500" />
                                                                            </div>
                                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Desire Quotes</h4>
                                                                        </div>
                                                                        {desireQuotes && desireQuotes.length > 0 ? (
                                                                            renderQuoteList(desireQuotes)
                                                                        ) : (
                                                                            <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Objections */}
                                                                    <div className="space-y-3 p-5 rounded-lg bg-muted/20 border border-border/50">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center border border-orange-500/20">
                                                                                <ShieldAlert className="h-4 w-4 text-orange-500" />
                                                                            </div>
                                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Objections</h4>
                                                                        </div>
                                                                        {objections && objections.length > 0 ? (
                                                                            <div className="space-y-3">
                                                                                {objections.map((objection: string, idx: number) => (
                                                                                    <div key={idx} className="bg-card p-4 rounded-lg border border-border/50 text-sm">
                                                                                        <div className="flex items-start gap-3">
                                                                                            <ShieldAlert className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                                                                            <div className="flex-1">
                                                                                                <p className="text-foreground/80 leading-relaxed">{objection}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-muted-foreground/30 italic text-xs">N/A</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Words They Use & Words They Avoid */}
                                                                {/*{(wordsTheyUse || wordsTheyAvoid) && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        {/* Words They Use 
                                                                        {wordsTheyUse && (
                                                                            <div className="space-y-3 p-5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                                                                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                                                    </div>
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Words They Use</h4>
                                                                                </div>
                                                                                {wordsTheyUse.length > 0 ? (
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {wordsTheyUse.map((word: string, idx: number) => (
                                                                                            <span key={idx} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-md border border-emerald-500/20">
                                                                                                {word}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground/30 italic text-xs">No words available</span>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {/* Words They Avoid 
                                                                        {wordsTheyAvoid && (
                                                                            <div className="space-y-3 p-5 rounded-lg bg-red-500/5 border border-red-500/20">
                                                                                <div className="flex items-center gap-2 mb-3">
                                                                                    <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
                                                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                                                    </div>
                                                                                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Words They Avoid</h4>
                                                                                </div>
                                                                                {wordsTheyAvoid.length > 0 ? (
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {wordsTheyAvoid.map((word: string, idx: number) => (
                                                                                            <span key={idx} className="px-3 py-1.5 bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-medium rounded-md border border-red-500/20">
                                                                                                {word}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground/30 italic text-xs">No words available</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}*/}
                                                            </>
                                                        );
                                                    })()}

                                                    {/* Research Sources */}
                                                    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <BookOpen className="h-4 w-4 text-blue-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Research Sources</h4>
                                                        </div>
                                                        {renderList(offerBrief.research_inspiration?.research_sources)}
                                                    </div>

                                                    {/* Inspiration Swipes */}
                                                    {/*<div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Sparkles className="h-4 w-4 text-purple-500" />
                                                            <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">Inspiration Swipes</h4>
                                                        </div>
                                                        {offerBrief.research_inspiration?.inspiration_swipes && offerBrief.research_inspiration.inspiration_swipes.length > 0 ? (
                                                            <div className="space-y-3">
                                                                {offerBrief.research_inspiration.inspiration_swipes.map((swipe: any, idx: number) => (
                                                                    <div key={idx} className="bg-card p-3 rounded-lg border border-border/50">
                                                                        <div className="font-semibold text-sm text-foreground mb-1">{swipe.title}</div>
                                                                        <div className="text-xs text-foreground/80 leading-relaxed">{swipe.notes}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground/30 italic text-xs">No inspiration swipes available</span>
                                                        )}
                                                    </div>*/}
                                                </AccordionContent>
                                            </AccordionItem>

                                            {/* Expand All / Close All Buttons */}
                                            <div className="flex items-center justify-end gap-2 pt-4 pb-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleExpandAll}
                                                    className="flex items-center gap-1.5 text-xs text-foreground hover:bg-muted h-7 px-3 border-border/60"
                                                >
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                    Expand All
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleCloseAll}
                                                    className="flex items-center gap-1.5 text-xs text-foreground hover:bg-muted h-7 px-3 border-border/60"
                                                >
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                    Close All
                                                </Button>
                                            </div>
                                        </Accordion>
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>
                </div>
            )}


            {/* Legacy/Raw Data Section (Collapsible) */}
            {/*<Accordion type="single" collapsible className="w-full bg-muted/10 rounded-lg border border-border/40">
                <AccordionItem value="raw-data" className="border-none px-4">
                    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground">
                        View Raw Research Analysis & Prompts 
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4 space-y-6">
                        {/* Summary 
                        {results.summary && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    Executive Summary
                                </h4>
                                <div className="text-sm text-foreground bg-background p-4 rounded-lg border">
                                    <MarkdownContent content={results.summary} />
                                </div>
                            </div>
                        )}

                        {/* Research Page Analysis
                        {results.research_page_analysis && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Sales Page Analysis
                                </h4>
                                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap bg-background p-4 rounded-lg border max-h-[400px] overflow-y-auto">
                                    {results.research_page_analysis}
                                </div>
                            </div>
                        )}

                        {/* Deep Research Prompt 
                        {results.deep_research_prompt && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <Brain className="h-4 w-4" />
                                    Research Prompt
                                </h4>
                                <div className="text-xs text-muted-foreground bg-background p-4 rounded-lg whitespace-pre-wrap font-mono border max-h-[300px] overflow-y-auto">
                                    <MarkdownContent content={results.deep_research_prompt} />
                                </div>
                            </div>
                        )}
                        
                        {/* Deep Research Output 
                        {results.deep_research_output && (
                             <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Full Research Output
                                </h4>
                                <div className="text-xs text-muted-foreground bg-background p-4 rounded-lg border max-h-[400px] overflow-y-auto">
                                    <MarkdownContent content={results.deep_research_output} />
                                </div>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>*/}
        </div>
    );
}
