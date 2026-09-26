// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MandateRegistry} from "./MandateRegistry.sol";
import {ArtworkRegistry} from "./LifecycleRegistry.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
interface IExpiry { function findExpiry(string calldata label) external view returns(uint64); }

/// Noncustodial listings: gallery lists, owner retains NFT until the buyer settles.
contract SimpleSettlement is ReentrancyGuard {
    struct Listing { uint256 mandateId; uint256 price; uint64 createdAt; bool sold; }
    struct SaleReceipt { address buyer; address seller; uint256 tokenId; uint256 price; uint256 commission; uint256 royalty; uint64 timestamp; }
    mapping(uint256=>SaleReceipt) public saleReceipt;
    MandateRegistry public immutable mandates;
    ArtworkRegistry public immutable artwork;
    uint256 public count;
    mapping(uint256=>Listing) public listings;
    mapping(address=>uint256) public proceeds;
    event Listed(uint256 indexed id,uint256 indexed mandateId,uint256 price);
    event Settled(uint256 indexed id,uint256 indexed tokenId,address indexed buyer,address seller,uint256 price,uint256 commission,uint256 royalty);
    event Withdrawn(address indexed recipient,uint256 amount);
    constructor(MandateRegistry mandates_) { mandates=mandates_; artwork=mandates_.artwork(); }
    function _linked() private view {
        (IRegistry namespace,string memory child)=artwork.getParent();
        (IRegistry root,string memory label)=namespace.getParent();
        require(address(namespace.getSubregistry(child))==address(artwork) && address(root.getSubregistry(label))==address(namespace),"ENS namespace not linked");
        require(IExpiry(address(root)).findExpiry(label)>block.timestamp,"ENS parent expired");
    }
    function list(uint256 mandateId,uint256 price) external returns(uint256 id) {
        _linked();
        MandateRegistry.Mandate memory m=mandates.get(mandateId);
        require(msg.sender==m.gallery && mandates.active(mandateId,257),"Sale mandate inactive");
        require(artwork.saleAllowed(m.tokenId),"Artwork holding period active");
        require(price>=m.minPrice,"Below minimum price");
        id=++count; listings[id]=Listing(mandateId,price,uint64(block.timestamp),false); emit Listed(id,mandateId,price);
    }
    function buy(uint256 id) external payable nonReentrant {
        _linked(); Listing storage l=listings[id];
        require(l.createdAt!=0 && !l.sold && msg.value==l.price,"Invalid listing or payment");
        require(mandates.active(l.mandateId,257),"Sale mandate inactive");
        MandateRegistry.Mandate memory m=mandates.get(l.mandateId);
        require(msg.sender!=m.gallery && msg.sender!=m.owner,"Independent collector required");
        require(l.price>=m.minPrice,"Below minimum price");
        l.sold=true;
        uint256 commission=Math.mulDiv(msg.value,m.commissionBps,10000);
        (address recipient,uint256 royalty)=artwork.royaltyInfo(m.tokenId,msg.value);
        if(artwork.ownershipEpoch(m.tokenId)==0 && m.owner==artwork.artist()) royalty=0;
        require(commission+royalty<=msg.value,"Invalid split");
        proceeds[m.gallery]+=commission; proceeds[recipient]+=royalty; proceeds[m.owner]+=msg.value-commission-royalty;
        saleReceipt[id]=SaleReceipt(msg.sender,m.owner,m.tokenId,msg.value,commission,royalty,uint64(block.timestamp));
        artwork.safeTransferFrom(m.owner,msg.sender,m.tokenId,1,"");
        emit Settled(id,m.tokenId,msg.sender,m.owner,msg.value,commission,royalty);
    }
    struct DirectListing { uint256 tokenId; address seller; uint256 epoch; uint256 price; uint64 expires; bool sold; }
    mapping(uint256=>DirectListing) public directListings;
    uint256 public directCount;
    event DirectListed(uint256 indexed id,uint256 indexed tokenId,address indexed seller,uint256 price);
    event DirectPurchased(uint256 indexed id,uint256 indexed tokenId,address indexed buyer,uint256 royalty);
    function listDirect(uint256 tokenId,uint256 price,uint64 expires) external returns(uint256 id) {
        _linked(); require(artwork.ownerOf(tokenId)==msg.sender,"Only current owner");
        require(artwork.saleAllowed(tokenId),"Artwork holding period active");
        require(price>0 && expires>block.timestamp,"Invalid price or expiry");
        id=++directCount; directListings[id]=DirectListing(tokenId,msg.sender,artwork.ownershipEpoch(tokenId),price,expires,false);
        emit DirectListed(id,tokenId,msg.sender,price);
    }
    function cancelDirect(uint256 id) external { require(directListings[id].seller==msg.sender,"Only seller"); directListings[id].sold=true; }
    function directActive(uint256 id) public view returns(bool) {
        DirectListing memory d=directListings[id];
        return artwork.saleAllowed(d.tokenId) && d.price>0 && !d.sold && d.expires>block.timestamp && artwork.ownerOf(d.tokenId)==d.seller && artwork.ownershipEpoch(d.tokenId)==d.epoch;
    }
    function buyDirect(uint256 id) external payable nonReentrant {
        _linked(); require(directActive(id),"Direct listing inactive");
        DirectListing storage d=directListings[id]; require(msg.value==d.price && msg.sender!=d.seller,"Invalid buyer or payment");
        d.sold=true; (address recipient,uint256 royalty)=artwork.royaltyInfo(d.tokenId,msg.value);
        if(artwork.ownershipEpoch(d.tokenId)==0 && d.seller==artwork.artist()) royalty=0;
        proceeds[recipient]+=royalty; proceeds[d.seller]+=msg.value-royalty;
        artwork.safeTransferFrom(d.seller,msg.sender,d.tokenId,1,"");
        emit DirectPurchased(id,d.tokenId,msg.sender,royalty);
    }
    function withdraw() external nonReentrant {
        uint256 amount=proceeds[msg.sender]; require(amount>0,"No proceeds"); proceeds[msg.sender]=0;
        (bool ok,)=payable(msg.sender).call{value:amount}(""); require(ok,"Withdrawal failed"); emit Withdrawn(msg.sender,amount);
    }
}
